import process from 'node:process';
import { Text } from 'pixi.js';
import { allocationPerFrame, readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `hot-path-rules` suite. Each rule in the Hot Paths
// page becomes two versions of the same per-frame work over 1000 game objects:
// `avoid` is the pattern the rule warns against, and `prefer` is what it
// recommends. Both compute the same result, and the result is kept so the
// engine cannot skip the work.

const COUNT = 1000;
const GRID_COLS = 64;
const LABELS = 100;

interface Entity {
    x: number;
    y: number;
    vx: number;
    alive: boolean;
    readonly stats: { hp: number; mp: number; str: number; dex: number };
    update(deltaMs: number): void;
}

/** One frame's work, written the way the rule warns against and the way it recommends. */
interface Variants {
    avoid(): void;
    prefer(): void;
}

const params = readParams();
const variant = String(params.variant);
if (variant !== 'avoid' && variant !== 'prefer') throw new Error(`unknown variant: ${variant}`);

// A typed array stores doubles in place. A plain `let` holding a double would
// allocate a heap number on every `+=`, and show up as allocation in every
// variant.
const sink = new Float64Array(1);

const variants = createVariants(String(params.rule), createEntities());
const frame = variant === 'avoid' ? variants.avoid : variants.prefer;

if (String(params.measure) === 'allocation') {
    report({ bytesPerFrame: await allocationPerFrame(frame) });
}
else {
    report({ usPerFrame: timeFrames(frame) });
}
if (sink[0] === 0.5) process.stdout.write('\n');

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function createVariants(rule: string, entities: Entity[]): Variants {
    if (rule === 'array-methods') return arrayMethods(entities);
    if (rule === 'for-of') return forOf(entities);
    if (rule === 'string-keys') return stringKeys(entities);
    if (rule === 'map-grid') return mapGrid(entities);
    if (rule === 'closures') return closures(entities);
    if (rule === 'object-keys') return objectKeys(entities);
    if (rule === 'tuples') return tuples(entities);
    if (rule === 'recompute') return recompute();
    if (rule === 'text') return text();
    throw new Error(`unknown rule: ${rule}`);
}

/** `.filter()` and `.map()` each allocate a new array. */
function arrayMethods(entities: Entity[]): Variants {
    return {
        avoid() {
            const xs = entities.filter((e) => e.alive).map((e) => e.x);
            let total = 0;
            for (let i = 0; i < xs.length; i++) total += xs[i];
            sink[0] += total;
        },
        prefer() {
            let total = 0;
            for (let i = 0; i < entities.length; i++) {
                if (entities[i].alive) total += entities[i].x;
            }
            sink[0] += total;
        },
    };
}

/** `for...of` may allocate an iterator. */
function forOf(entities: Entity[]): Variants {
    return {
        avoid() {
            for (const e of entities) e.x += e.vx;
            sink[0] += entities[0].x;
        },
        prefer() {
            for (let i = 0; i < entities.length; i++) entities[i].x += entities[i].vx;
            sink[0] += entities[0].x;
        },
    };
}

/** A 64-column grid, looked up once per entity: a template-string key allocates a string. */
function stringKeys(entities: Entity[]): Variants {
    const byKey = new Map<string, number>();
    const tiles: number[] = [];
    for (let r = 0; r < GRID_COLS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            byKey.set(`${r},${c}`, r + c);
            tiles.push(r + c);
        }
    }
    return {
        avoid() {
            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                sink[0] += byKey.get(`${e.y % GRID_COLS},${e.x % GRID_COLS}`) ?? 0;
            }
        },
        prefer() {
            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                sink[0] += tiles[(e.y % GRID_COLS) * GRID_COLS + (e.x % GRID_COLS)];
            }
        },
    };
}

/** The same lookups with a numeric key, to separate the cost of the `Map` from the string. */
function mapGrid(entities: Entity[]): Variants {
    const byIndex = new Map<number, number>();
    const tiles: number[] = [];
    for (let i = 0; i < GRID_COLS * GRID_COLS; i++) {
        byIndex.set(i, i);
        tiles.push(i);
    }
    return {
        avoid() {
            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                sink[0] += byIndex.get((e.y % GRID_COLS) * GRID_COLS + (e.x % GRID_COLS)) ?? 0;
            }
        },
        prefer() {
            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                sink[0] += tiles[(e.y % GRID_COLS) * GRID_COLS + (e.x % GRID_COLS)];
            }
        },
    };
}

/** An inline closure capturing `deltaMs` is a new function object every frame. */
function closures(entities: Entity[]): Variants {
    let deltaMs = 16;
    return {
        avoid() {
            deltaMs = 16 + (sink[0] & 1);
            entities.forEach((e) => e.update(deltaMs));
            sink[0] += entities[0].x;
        },
        prefer() {
            deltaMs = 16 + (sink[0] & 1);
            for (let i = 0; i < entities.length; i++) entities[i].update(deltaMs);
            sink[0] += entities[0].x;
        },
    };
}

/** `Object.values()` allocates an array per call. */
function objectKeys(entities: Entity[]): Variants {
    return {
        avoid() {
            let total = 0;
            for (let i = 0; i < entities.length; i++) {
                const values = Object.values(entities[i].stats);
                for (let k = 0; k < values.length; k++) total += values[k];
            }
            sink[0] += total;
        },
        prefer() {
            let total = 0;
            for (let i = 0; i < entities.length; i++) {
                const s = entities[i].stats;
                total += s.hp + s.mp + s.str + s.dex;
            }
            sink[0] += total;
        },
    };
}

/** Returning a `[col, row]` tuple allocates an array per call, unless the engine removes it. */
function tuples(entities: Entity[]): Variants {
    const out = { col: 0, row: 0 };
    return {
        avoid() {
            for (let i = 0; i < entities.length; i++) {
                const [col, row] = toGridTuple(entities[i]);
                sink[0] += col + row;
            }
        },
        prefer() {
            for (let i = 0; i < entities.length; i++) {
                toGridOut(entities[i], out);
                sink[0] += out.col + out.row;
            }
        },
    };
}

/** A total over 1000 scores, one of which changes once a second: sum every frame, or only on change. */
function recompute(): Variants {
    const scores: number[] = [];
    for (let i = 0; i < COUNT; i++) scores.push(i);
    let tick = 0;
    let version = 0;
    let cachedVersion = -1;
    let cachedTotal = 0;
    const change = (): void => {
        if (++tick % 60 === 0) {
            scores[tick % COUNT]++;
            version++;
        }
    };
    return {
        avoid() {
            change();
            let total = 0;
            for (let i = 0; i < scores.length; i++) total += scores[i];
            sink[0] += total;
        },
        prefer() {
            change();
            if (version !== cachedVersion) {
                cachedVersion = version;
                cachedTotal = 0;
                for (let i = 0; i < scores.length; i++) cachedTotal += scores[i];
            }
            sink[0] += cachedTotal;
        },
    };
}

/** 100 Pixi `Text` labels showing scores that change once a second: set every frame, or only on change. */
function text(): Variants {
    const labels: Text[] = [];
    const previous: number[] = [];
    for (let i = 0; i < LABELS; i++) {
        labels.push(new Text({ text: '0' }));
        previous.push(-1);
    }
    let tick = 0;
    return {
        avoid() {
            const score = Math.floor(++tick / 60);
            for (let i = 0; i < labels.length; i++) labels[i].text = String(score + i);
        },
        prefer() {
            const score = Math.floor(++tick / 60);
            for (let i = 0; i < labels.length; i++) {
                if (score + i === previous[i]) continue;
                previous[i] = score + i;
                labels[i].text = String(score + i);
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createEntities(): Entity[] {
    const entities: Entity[] = [];
    for (let i = 0; i < COUNT; i++) {
        const entity: Entity = {
            x: i,
            y: i * 7,
            vx: 1,
            alive: i % 4 !== 0,
            stats: { hp: i, mp: 2, str: 3, dex: 4 },
            update(deltaMs) {
                entity.x += (entity.vx * deltaMs) / 16;
            },
        };
        entities.push(entity);
    }
    return entities;
}

function toGridTuple(e: Entity): [number, number] {
    return [Math.floor(e.x / 16), Math.floor(e.y / 16)];
}

function toGridOut(e: Entity, out: { col: number; row: number }): void {
    out.col = Math.floor(e.x / 16);
    out.row = Math.floor(e.y / 16);
}
