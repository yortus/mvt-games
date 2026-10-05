import { Container } from 'pixi.js';
import { findEntry } from '@mvtjs/website/catalogue';
import type { EntryInputConfig, PixiEntryStarter } from '@mvtjs/website/entries';
import { hasRefresh, hasUpdate, refreshView, updateView } from '@mvtjs/pixi';
import { allocationPerFrame, gcDuring, readParams, report } from '../harness/measure';
import { stubTextMeasurement } from '../harness/text-measurement';

// Measured file for the `games-and-demos` suite: the games and demos in this
// repo, as they ship, each started through its entry and run headless under
// Node. The games get scripted input; the demos run unattended, as they do
// before anyone touches them. Textures and text measurement are stubbed (see
// the driver and `stubTextMeasurement`), and nothing is rendered, so this is
// each one's own frame work: the session's update, which advances its models,
// then a tick of the stage, as the website's entry host runs them.
//
// measure `time`: mean µs per frame over one simulated minute (3600 frames)
//   after a 10-second warm-up, split into the models, `updateView` and
//   `refreshView`.
// measure `allocation`: bytes allocated per frame.
// measure `gc`: garbage collections over one simulated minute.

const FRAME_MS = 1000 / 60;
const WARMUP_FRAMES = 600;
const MEASURED_FRAMES = 3600;

type Direction = 'left' | 'none' | 'right';
type VerticalDirection = 'up' | 'none' | 'down';

const X_PATTERN: readonly Direction[] = ['left', 'none', 'right', 'none'];
const Y_PATTERN: readonly VerticalDirection[] = ['up', 'none', 'down', 'none'];

stubTextMeasurement();

const params = readParams();
const measure = String(params.measure);
const starter = await loadPixiStarter(String(params.entry));
const stage = new Container();
const session = starter.start({ stage });
const input = createInputScript(session.inputConfig);
let frameIndex = 0;

const frame = (): void => {
    input(frameIndex++);
    session.update(FRAME_MS);
    updateView(stage, FRAME_MS);
    refreshView(stage);
};

if (measure === 'time') {
    for (let f = 0; f < WARMUP_FRAMES; f++) frame();
    let modelsMs = 0;
    let updateMs = 0;
    let refreshMs = 0;
    for (let f = 0; f < MEASURED_FRAMES; f++) {
        input(frameIndex++);
        const start = performance.now();
        session.update(FRAME_MS);
        const modelsDone = performance.now();
        updateView(stage, FRAME_MS);
        const updateDone = performance.now();
        refreshView(stage);
        const refreshDone = performance.now();
        modelsMs += modelsDone - start;
        updateMs += updateDone - modelsDone;
        refreshMs += refreshDone - updateDone;
    }
    const counts = countStage(stage);
    report({
        modelsUs: (modelsMs * 1000) / MEASURED_FRAMES,
        updateUs: (updateMs * 1000) / MEASURED_FRAMES,
        refreshUs: (refreshMs * 1000) / MEASURED_FRAMES,
        totalUs: ((modelsMs + updateMs + refreshMs) * 1000) / MEASURED_FRAMES,
        containers: counts.containers,
        methods: counts.methods,
    });
}
else if (measure === 'allocation') {
    report({ bytesPerFrame: await allocationPerFrame(frame) });
}
else {
    const gc = await gcDuring(frame, MEASURED_FRAMES);
    report({ minorGcs: gc.minor, majorGcs: gc.major, gcPauseMs: gc.pauseMs });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Loads a game or demo by id, as the website would launch it. Only entries drawn with Pixi run headless here. */
async function loadPixiStarter(id: string): Promise<PixiEntryStarter> {
    const entry = findEntry(id);
    if (entry === undefined) throw new Error(`unknown game or demo: ${id}`);
    const starter = await entry.load();
    if (starter.kind !== 'pixi') throw new Error(`${id} is not drawn with Pixi, so it cannot run headless`);
    return starter;
}

/**
 * A fixed, repeating input pattern for the games, so every process plays the
 * same way: the horizontal direction changes every half second, the vertical
 * every 0.7 seconds, and the primary and secondary buttons are pressed briefly
 * every second and every 1.5 seconds. Only changes are sent, as real input
 * would be. Demos have no `inputConfig`, so they get none.
 */
function createInputScript(config: EntryInputConfig | undefined): (frame: number) => void {
    return (f) => {
        if (config === undefined) return;
        if (f % 30 === 0) config.onXDirectionChanged?.(X_PATTERN[(f / 30) % X_PATTERN.length]);
        if (f % 42 === 0) config.onYDirectionChanged?.(Y_PATTERN[(f / 42) % Y_PATTERN.length]);
        if (f % 60 === 0) config.onPrimaryButtonChanged?.(true);
        if (f % 60 === 5) config.onPrimaryButtonChanged?.(false);
        if (f % 90 === 20) config.onSecondaryButtonChanged?.(true);
        if (f % 90 === 25) config.onSecondaryButtonChanged?.(false);
    };
}

function countStage(root: Container): { containers: number; methods: number } {
    let containers = 0;
    let methods = 0;
    const visit = (node: Container): void => {
        containers++;
        if (hasRefresh(node)) methods++;
        if (hasUpdate(node)) methods++;
        const children = node.children;
        for (let i = 0; i < children.length; i++) visit(children[i]);
    };
    visit(root);
    return { containers, methods };
}
