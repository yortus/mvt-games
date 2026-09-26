import { Container } from 'pixi.js';
import { createDemoModel, DemoView, type DemoModel } from '../../src/demos/falling-sand';
import { countPropReads } from '../../src/pixi-jsx';
import { refreshScene, updateScene } from '../../src/pixi-mvt';
import { readParams, report } from '../harness/measure';

// Measured file for the `falling-sand-scaling` suite: the falling-sand demo,
// headless, with its tank filled to a given number of grains. Builds the
// model and view directly, as the `scaling` suite builds its scene, since the
// demo's entry has no way to set a grain count or flip on a schedule. One
// sprite per grain, so the refresh pass does work for every grain every
// frame, while the model only does work for the grains that are moving.
//
// scenario `settled`: every grain asleep; nothing in the tank moves.
// scenario `flipping`: the tank flips every 3 seconds, so most grains are
//   falling most of the time (and still for the half second of each flip).
//
// Reports mean µs per frame over 30 simulated seconds, after a 6-second
// warm-up, split into the model, the update pass and the refresh pass as the
// demo runs them; and prop reads per frame, counted over a further cycle
// that is not timed, so counting cannot skew the times.

const FRAME_MS = 1000 / 60;
const CYCLE_FRAMES = 180;
const WARMUP_FRAMES = CYCLE_FRAMES * 2;
const MEASURED_FRAMES = CYCLE_FRAMES * 10;

// The demo's tank, in cells
const TANK_COLS = 152;
const TANK_ROWS = 180;

const params = readParams();
const grains = Number(params.grains);
const scenario = String(params.scenario);
if (scenario !== 'settled' && scenario !== 'flipping') throw new Error(`unknown scenario: ${scenario}`);

const model = fillTank(grains);
const stage = new Container();
const view = DemoView({ model, frameStats: () => undefined });
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

const readsPerFrame = countPropReads(() => {
    for (let f = 0; f < CYCLE_FRAMES; f++) frame();
}) / CYCLE_FRAMES;

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
 * The model is seeded, so every process fills it identically.
 */
function fillTank(target: number): DemoModel {
    const tank = createDemoModel({ cols: TANK_COLS, rows: TANK_ROWS, scene: 'empty' });
    const sandTarget = Math.round(target * 0.75);
    tank.tool = 'sand';
    tank.startPour(10, 10);
    for (let f = 0; tank.grainCount < target; f++) {
        if (tank.tool === 'sand' && tank.grainCount >= sandTarget) {
            tank.endPour();
            tank.tool = 'water';
            tank.startPour(10, 10);
        }
        tank.movePour(10 + ((f * 2) % (TANK_COLS - 20)), 10);
        tank.update(FRAME_MS);
    }
    tank.endPour();

    for (let f = 0; f < 60 * 120 && tank.movingCount > 0; f++) tank.update(FRAME_MS);
    return tank;
}
