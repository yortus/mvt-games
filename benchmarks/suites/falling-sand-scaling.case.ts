import { Container } from 'pixi.js';
import {
    createDemoModel, type DemoSnapshot, DemoView, type GrainKind, type GrainStorageKind, type GrainsViewKind, TANK_SIZES, type TankSizeKind,
} from '../../src/demos/falling-sand';
import { countReads, tickScene } from '@mvtjs/pixi';
import { cached } from '../harness/case-cache';
import { readParams, report } from '../harness/measure';

// Measured file for the `falling-sand-scaling` suite: the falling-sand demo,
// headless, with its tank filled to a given number of grains, run with one
// of its model and view variants. Builds the model and view directly, as the
// `scaling` suite builds its scene, since the demo's entry has no way to set
// a grain count or flip on a schedule.
//
// variant `<storage>-<view>[-polled]`: how the model stores its grains
//   (`objects`, a record per grain; `arrays`, a typed array per field;
//   `store`, a SolidJS store), and how the view draws them (`sprites`, a
//   sprite per grain; `pixels`, a pixel per cell in one texture). A store is
//   drawn by the SolidJS views, whose effects run inside `model.update()`, so
//   their cost shows in the model column; `-polled` draws it with the polled
//   views instead, to measure the store alone. Headless, so the pixel views'
//   texture uploads, a GPU cost, are not measured.
// scenario `settled`: every grain asleep; nothing in the tank moves.
// scenario `flipping`: the tank flips every 3 seconds, so most grains are
//   falling most of the time (and still for the half second of each flip).
//
// Up to 20,000 grains fill the demo's small tank (27,360 cells); more fill
// its large one (246,240 cells), where grains have further to fall.
//
// Reports mean µs per frame over one 3-second cycle (the second after the
// tank is loaded when flipping, the first when settled), split into the model, the update scene pass and the
// refresh scene pass as the demo runs them; and reads per frame, counted
// over the same cycle in an untimed pass, so counting cannot skew the times.
//
// Every variant times the same simulated frames. The tank is a snapshot,
// which the model restores exactly, random numbers included, so the timed
// cycle is replayed from it: once for a slow variant, and for a cheap one
// until about 3 seconds have been timed, at most 10 times. Before the first,
// the code warms up for at least 1000 frames and 300 ms, in whole cycles (or
// 2 s, for a variant slow enough to reach it first).

const FRAME_MS = 1000 / 60;
const CYCLE_FRAMES = 180;
const WARMUP_MIN_FRAMES = 1000;
const WARMUP_MIN_MS = 300;
const WARMUP_MAX_MS = 2000;
const MEASURE_TARGET_MS = 3000;
const MAX_REPLAYS = 10;
/** Each grain kind as the literal the model's code uses: see `withLiteralKinds`. */
const GRAIN_KIND_LITERALS: Readonly<Record<GrainKind, GrainKind>> = { sand: 'sand', water: 'water', wall: 'wall' };

const params = readParams();
const grains = Number(params.grains);
const scenario = String(params.scenario);
if (scenario !== 'settled' && scenario !== 'flipping') throw new Error(`unknown scenario: ${scenario}`);
const [storage, grainsView, polled] = String(params.variant).split('-') as [GrainStorageKind, GrainsViewKind, string?];
const isStore = storage === 'store';
/**
 * Cycles run from the loaded tank before the timed one: one when flipping,
 * so the timed cycle starts mid-run, with grains in motion; none when
 * settled, since a settled tank's every cycle is alike.
 */
const LEAD_IN_CYCLES = scenario === 'flipping' ? 1 : 0;
const tankSize: TankSizeKind = grains <= 20000 ? 'small' : 'large';

const snapshot = withLiteralKinds(cached(`tank-${tankSize}-${grains}`, () => fillTank(grains)));
const model = createDemoModel({ ...TANK_SIZES[tankSize], storage, scene: 'empty' });
model.load(snapshot);
const stage = new Container();
const view = DemoView({
    model,
    grainsView,
    tankSize,
    isReactive: isStore && polled === undefined,
    frameStats: () => undefined,
});
stage.addChild(view);

let frameIndex = 0;
const frame = (): void => {
    if (scenario === 'flipping' && frameIndex % CYCLE_FRAMES === 0) model.flip();
    frameIndex++;
    model.update(FRAME_MS);
    tickScene({ root: stage, deltaMs: FRAME_MS });
};

// Untimed: the lead-in, the timed cycle with its reads counted, then more
// cycles until the code is warm
const warmUpStart = performance.now();
for (let c = 0; c < LEAD_IN_CYCLES; c++) runCycle();
const readsPerFrame = countReads(runCycle) / CYCLE_FRAMES;
for (let c = LEAD_IN_CYCLES + 1; !isWarm(c * CYCLE_FRAMES, performance.now() - warmUpStart); c++) runCycle();

let modelMs = 0;
let updateMs = 0;
let refreshMs = 0;
let movingTotal = 0;
let replays = 0;
do {
    model.load(snapshot);
    frameIndex = 0;
    for (let c = 0; c < LEAD_IN_CYCLES; c++) runCycle();
    for (let f = 0; f < CYCLE_FRAMES; f++) {
        if (scenario === 'flipping' && frameIndex % CYCLE_FRAMES === 0) model.flip();
        frameIndex++;
        const start = performance.now();
        model.update(FRAME_MS);
        const modelled = performance.now();
        tickScene({ root: stage, deltaMs: FRAME_MS, only: 'update' });
        const updated = performance.now();
        tickScene({ root: stage, only: 'refresh' });
        const refreshed = performance.now();
        modelMs += modelled - start;
        updateMs += updated - modelled;
        refreshMs += refreshed - updated;
        movingTotal += model.movingCount;
    }
    replays++;
} while (replays < MAX_REPLAYS && modelMs + updateMs + refreshMs < MEASURE_TARGET_MS);

const MEASURED_FRAMES = CYCLE_FRAMES * replays;
const toUs = (ms: number): number => (ms * 1000) / MEASURED_FRAMES;
report({
    grains: model.grainCount,
    movingGrains: movingTotal / MEASURED_FRAMES,
    modelUs: toUs(modelMs),
    updateUs: toUs(updateMs),
    refreshUs: toUs(refreshMs),
    totalUs: toUs(modelMs + updateMs + refreshMs),
    refreshNsPerGrain: (refreshMs * 1e6) / MEASURED_FRAMES / model.grainCount,
    readsPerFrame,
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function runCycle(): void {
    for (let f = 0; f < CYCLE_FRAMES; f++) frame();
}

/** Whether a warm-up of `frames` frames over `elapsedMs` is enough, as `timeFrames` decides. */
function isWarm(frames: number, elapsedMs: number): boolean {
    return (frames >= WARMUP_MIN_FRAMES && elapsedMs >= WARMUP_MIN_MS) || elapsedMs >= WARMUP_MAX_MS;
}

/**
 * The snapshot with each grain's kind as the string literal the model's own
 * code uses. A snapshot loaded from the cache has every string deserialized
 * as a new one, and comparing those against a literal compares their
 * characters rather than their identity, which made the `objects` storage's
 * pixel view 40-55% slower than with a poured tank.
 */
function withLiteralKinds(loaded: DemoSnapshot): DemoSnapshot {
    const kinds = loaded.grid.kinds.map((kind) => (kind === undefined ? undefined : GRAIN_KIND_LITERALS[kind]));
    return { ...loaded, grid: { ...loaded.grid, kinds } };
}

/**
 * An empty tank poured to `target` grains, three quarters sand and then
 * water, swept back and forth across the top, and left to settle, as a
 * snapshot to load. The last step's pour can overshoot by a few grains; the
 * actual count is reported.
 *
 * The model is seeded, and all storage kinds behave identically, so the
 * snapshot is the same whichever kind fills it. It is built once per suite
 * run (see `cached`), by the first case of that size, and loaded by every
 * case, the first included, into a tank created empty: each measured tank
 * has the same history. It is filled in a tank of the storage being
 * measured, so no call site in the process ever sees another storage kind's
 * functions, which would make V8 optimise it less well. The exception is a
 * store, too slow to fill a tank in reasonable time: it fills with arrays,
 * before any view exists, and only the model's few calls per step into its
 * grid then see both. A store is never first in a whole run of the suite.
 */
function fillTank(target: number): DemoSnapshot {
    const tank = createDemoModel({ ...TANK_SIZES[tankSize], storage: isStore ? 'arrays' : storage, scene: 'empty' });
    const sandTarget = Math.round(target * 0.75);
    const sweep = tank.cols - 20;
    tank.tool = 'sand';
    tank.startPour(10, 10);
    for (let f = 0; tank.grainCount < target; f++) {
        if (f > 60 * 600) throw new Error(`could not pour ${target} grains; stuck at ${tank.grainCount}`);
        if (tank.tool === 'sand' && tank.grainCount >= sandTarget) {
            tank.endPour();
            tank.tool = 'water';
            tank.startPour(10, 10);
        }
        tank.movePour(10 + ((f * 2) % sweep), 10);
        tank.update(FRAME_MS);
    }
    tank.endPour();

    for (let f = 0; f < 60 * 120 && tank.movingCount > 0; f++) tank.update(FRAME_MS);
    return tank.save();
}
