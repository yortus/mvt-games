import {
    KINDS,
    DEFAULT_ROWS,
    DEFAULT_COLS,
    DEFAULT_COUNT,
    MIN_ENTITIES,
    MAX_ENTITIES,
    type EntityKind,
} from '../constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A single placed entity. Fields are read by the derivations each recompute. */
export interface WorldEntity {
    readonly id: number;
    kind: EntityKind;
    row: number;
    col: number;
    active: boolean;
}

/**
 * The source model for the derive demo: a grid of placed entities that churn
 * over time. It exposes raw state plus three revision counters - the primitive
 * change-triggers the derivations gate on. It holds no derived structures of
 * its own; those are rebuilt on the read side via `derive`.
 */
export interface WorldModel {
    readonly rows: number;
    readonly cols: number;

    /** Number of live entities. */
    readonly entityCount: number;
    /** Live reference to the entity at `index` (0 <= index < entityCount). */
    getEntity(index: number): WorldEntity;

    /** Bumps on any spatial-occupancy change: add, remove, move, retype. */
    readonly gridRevision: number;
    /** Bumps on any roster change that affects kind counts/order: add, remove, retype. */
    readonly rosterRevision: number;
    /** Bumps on any active-set change: add, remove, toggle-active. */
    readonly activeRevision: number;

    /** Continuously advancing value (radians) for cosmetic, read-directly motion. */
    readonly phase: number;

    /** Whether the model mutates itself over time in `update`. */
    autoChurn: boolean;

    /** Advance continuous phase and, when enabled, apply periodic churn. */
    update(deltaMs: number): void;

    spawn(): void;
    removeOne(): void;
    retypeOne(): void;
    moveOne(): void;
    toggleActiveOne(): void;
    reset(): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WorldModelOptions {
    rows?: number;
    cols?: number;
    initialCount?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWorldModel(options: WorldModelOptions = {}): WorldModel {
    const rows = options.rows ?? DEFAULT_ROWS;
    const cols = options.cols ?? DEFAULT_COLS;
    const cellCount = rows * cols;

    const entities: WorldEntity[] = [];
    const occupied = new Set<number>();
    let nextId = 1;

    let gridRevision = 0;
    let rosterRevision = 0;
    let activeRevision = 0;

    let phase = 0;
    let autoChurn = true;

    // Churn timers (domain time only - advanced by deltaMs).
    let moveTimer = 0;
    let rosterTimer = 0;
    let activeTimer = 0;

    reset();

    const model: WorldModel = {
        get rows() {
            return rows;
        },
        get cols() {
            return cols;
        },
        get entityCount() {
            return entities.length;
        },
        getEntity(index: number): WorldEntity {
            return entities[index];
        },
        get gridRevision() {
            return gridRevision;
        },
        get rosterRevision() {
            return rosterRevision;
        },
        get activeRevision() {
            return activeRevision;
        },
        get phase() {
            return phase;
        },
        get autoChurn() {
            return autoChurn;
        },
        set autoChurn(value: boolean) {
            autoChurn = value;
        },

        update(deltaMs: number): void {
            phase += deltaMs * PHASE_SPEED;
            if (phase > TWO_PI) phase -= TWO_PI;

            if (!autoChurn) return;

            moveTimer += deltaMs;
            rosterTimer += deltaMs;
            activeTimer += deltaMs;

            if (moveTimer >= MOVE_INTERVAL_MS) {
                moveTimer -= MOVE_INTERVAL_MS;
                moveOne();
            }
            if (rosterTimer >= ROSTER_INTERVAL_MS) {
                rosterTimer -= ROSTER_INTERVAL_MS;
                // Alternate between resizing the roster and retyping.
                if (Math.random() < 0.5) {
                    if (entities.length >= MAX_ENTITIES || (entities.length > MIN_ENTITIES && Math.random() < 0.5)) {
                        removeOne();
                    }
                    else {
                        spawn();
                    }
                }
                else {
                    retypeOne();
                }
            }
            if (activeTimer >= ACTIVE_INTERVAL_MS) {
                activeTimer -= ACTIVE_INTERVAL_MS;
                toggleActiveOne();
            }
        },

        spawn,
        removeOne,
        retypeOne,
        moveOne,
        toggleActiveOne,
        reset,
    };

    return model;

    // ---- Mutators ----------------------------------------------------------

    function spawn(): void {
        if (entities.length >= MAX_ENTITIES) return;
        const cellIndex = findEmptyCell();
        if (cellIndex < 0) return;
        occupied.add(cellIndex);
        entities.push({
            id: nextId++,
            kind: randomKind(),
            row: Math.floor(cellIndex / cols),
            col: cellIndex % cols,
            active: Math.random() < 0.6,
        });
        gridRevision++;
        rosterRevision++;
        activeRevision++;
    }

    function removeOne(): void {
        if (entities.length <= MIN_ENTITIES) return;
        const index = randomIndex();
        const entity = entities[index];
        occupied.delete(entity.row * cols + entity.col);
        // Swap-pop removal.
        entities[index] = entities[entities.length - 1];
        entities.pop();
        gridRevision++;
        rosterRevision++;
        activeRevision++;
    }

    function retypeOne(): void {
        if (entities.length === 0) return;
        const entity = entities[randomIndex()];
        let kind = randomKind();
        if (kind === entity.kind) kind = KINDS[(KIND_OF(entity.kind) + 1) % KINDS.length];
        entity.kind = kind;
        gridRevision++;
        rosterRevision++;
    }

    function moveOne(): void {
        if (entities.length === 0) return;
        const cellIndex = findEmptyCell();
        if (cellIndex < 0) return;
        const entity = entities[randomIndex()];
        occupied.delete(entity.row * cols + entity.col);
        occupied.add(cellIndex);
        entity.row = Math.floor(cellIndex / cols);
        entity.col = cellIndex % cols;
        gridRevision++;
    }

    function toggleActiveOne(): void {
        if (entities.length === 0) return;
        const entity = entities[randomIndex()];
        entity.active = !entity.active;
        activeRevision++;
    }

    function reset(): void {
        entities.length = 0;
        occupied.clear();
        nextId = 1;
        const target = Math.min(options.initialCount ?? DEFAULT_COUNT, cellCount, MAX_ENTITIES);
        for (let i = 0; i < target; i++) {
            const cellIndex = findEmptyCell();
            if (cellIndex < 0) break;
            occupied.add(cellIndex);
            entities.push({
                id: nextId++,
                kind: randomKind(),
                row: Math.floor(cellIndex / cols),
                col: cellIndex % cols,
                active: Math.random() < 0.6,
            });
        }
        gridRevision++;
        rosterRevision++;
        activeRevision++;
    }

    // ---- Helpers -----------------------------------------------------------

    function findEmptyCell(): number {
        if (occupied.size >= cellCount) return -1;
        for (let attempt = 0; attempt < EMPTY_CELL_ATTEMPTS; attempt++) {
            const cell = Math.floor(Math.random() * cellCount);
            if (!occupied.has(cell)) return cell;
        }
        // Fallback: linear scan for a free cell.
        for (let cell = 0; cell < cellCount; cell++) {
            if (!occupied.has(cell)) return cell;
        }
        return -1;
    }

    function randomIndex(): number {
        return Math.floor(Math.random() * entities.length);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;
const PHASE_SPEED = 0.004; // radians per ms
const MOVE_INTERVAL_MS = 320;
const ROSTER_INTERVAL_MS = 1400;
const ACTIVE_INTERVAL_MS = 780;
const EMPTY_CELL_ATTEMPTS = 24;

function randomKind(): EntityKind {
    return KINDS[Math.floor(Math.random() * KINDS.length)];
}

function KIND_OF(kind: EntityKind): number {
    for (let i = 0; i < KINDS.length; i++) {
        if (KINDS[i] === kind) return i;
    }
    return 0;
}
