import { Container } from 'pixi.js';
import {
    createDemoModel, type DemoModel, DemoView, type GrainStorageKind, type GrainsViewKind, TANK_SIZES, type TankSizeKind,
} from '../../src/demos/falling-sand';
import { countReads, refreshScene, updateScene } from '../../src/pixi-mvt';
import { refreshMethodCounts } from '../../src/pixi-mvt/jsx';
import { readParams, report } from '../harness/measure';
import { checkRefreshPath, selectRefreshPath } from '../harness/refresh-path';

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
// refresh `generated` or `fallback`: how the JSX runtime refreshes bound
//   elements, the grain sprites among them (see `selectRefreshPath`).
//
// Up to 20,000 grains fill the demo's small tank (27,360 cells); more fill
// its large one (246,240 cells), where grains have further to fall.
//
// Reports mean µs per frame over 30 simulated seconds (9 above 20,000 grains,
// and 6 for a store, to keep the slowest variants' runs to a few minutes),
// after a warm-up (6 seconds; 3 for a store), split into the model, the update pass and the refresh pass as the
// demo runs them; and reads per frame, counted over a further cycle
// that is not timed, so counting cannot skew the times.

const FRAME_MS = 1000 / 60;
const CYCLE_FRAMES = 180;

const params = readParams();
selectRefreshPath(params.refresh);
const grains = Number(params.grains);
const scenario = String(params.scenario);
if (scenario !== 'settled' && scenario !== 'flipping') throw new Error(`unknown scenario: ${scenario}`);
const [storage, grainsView, polled] = String(params.variant).split('-') as [GrainStorageKind, GrainsViewKind, string?];
const isStore = storage === 'store';
const tankSize: TankSizeKind = grains <= 20000 ? 'small' : 'large';
const WARMUP_FRAMES = CYCLE_FRAMES * (isStore ? 1 : 2);
const MEASURED_FRAMES = CYCLE_FRAMES * (isStore ? 2 : grains <= 20000 ? 10 : 3);

const model = fillTank(grains);
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
    updateScene(view, FRAME_MS);
    refreshScene(stage);
};

for (let f = 0; f < WARMUP_FRAMES; f++) frame();

let modelMs = 0;
let updateMs = 0;
let refreshMs = 0;
let movingTotal = 0;
for (let f = 0; f < MEASURED_FRAMES; f++) {
    if (scenario === 'flipping' && frameIndex % CYCLE_FRAMES === 0) model.flip();
    frameIndex++;
    const start = performance.now();
    model.update(FRAME_MS);
    const modelled = performance.now();
    updateScene(view, FRAME_MS);
    const updated = performance.now();
    refreshScene(stage);
    const refreshed = performance.now();
    modelMs += modelled - start;
    updateMs += updated - modelled;
    refreshMs += refreshed - updated;
    movingTotal += model.movingCount;
}

const readsPerFrame = countReads(() => {
    for (let f = 0; f < CYCLE_FRAMES; f++) frame();
}) / CYCLE_FRAMES;

checkRefreshPath(params.refresh, refreshMethodCounts);
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

/**
 * An empty tank poured to `target` grains, three quarters sand and then
 * water, swept back and forth across the top, and left to settle. The last
 * step's pour can overshoot by a few grains; the actual count is reported.
 * The model is seeded, and all storage kinds behave identically, so every
 * process fills it identically, whatever the variant. It fills with the
 * storage being measured, so no call site in the process ever sees another
 * storage kind's functions, which would make V8 optimise it less well. The
 * exception is a store, too slow to fill a tank in reasonable time: it is
 * filled with arrays, then loaded from their snapshot, before any view
 * exists. Only the model's few calls per step into its grid then see both.
 */
function fillTank(target: number): DemoModel {
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
    if (!isStore) return tank;

    const store = createDemoModel({ ...TANK_SIZES[tankSize], storage, scene: 'empty' });
    store.load(tank.save());
    return store;
}
