import { Container } from 'pixi.js';
import { allocationPerFrame, gcDuring, readParams, report, retainedPerItem } from '../harness/measure';
import { createChangeDetectionFrame } from '../shared/change-detection-scene';
import { createPoolFrame } from '../shared/pool-scene';
import { createSyncedScene, type Approach } from '../shared/synced-scene';

// Measured file for the `memory` suite. Every case needs `--expose-gc`.
//
// measure `allocation`: bytes allocated per frame, with no garbage collection
//   inside the measured window.
// measure `gc`: garbage collections over one simulated minute (3600 frames),
//   with Node's default heap settings.
// measure `retained`: heap kept alive per Pixi container and its model record.

const params = readParams();
const measure = String(params.measure);
const scene = String(params.scene);
const approach = String(params.approach);

if (measure === 'retained') {
    report({ bytesPerContainer: retainedPerItem(buildRetained, 10000) });
}
else {
    const frame = createFrame();
    if (measure === 'allocation') {
        report({ bytesPerFrame: await allocationPerFrame(frame) });
    }
    else {
        const gc = await gcDuring(frame, 3600);
        report({ minorGcs: gc.minor, majorGcs: gc.major, gcPauseMs: gc.pauseMs });
    }
}

function createFrame(): () => void {
    const changedPercent = Number(params.changedPercent);
    if (scene === 'synced') {
        return createSyncedScene({ approach: approach as Approach, count: 1000, dynamicProperties: 3, changedPercent }).frame;
    }
    if (scene === 'discrete') return createChangeDetectionFrame('discrete', approach, changedPercent);
    if (scene === 'pool') return createPoolFrame(approach, Number(params.spawnPerFrame));
    throw new Error(`unknown scene: ${scene}`);
}

function buildRetained(count: number): unknown {
    if (approach === 'container-only') {
        const root = new Container();
        for (let i = 0; i < count; i++) root.addChild(new Container());
        return root;
    }
    return createSyncedScene({ approach: approach as Approach, count, dynamicProperties: 3, changedPercent: 0 });
}
