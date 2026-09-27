import { Container, type Sprite, Texture } from 'pixi.js';
import { jsx } from '../../src/pixi-jsx';
import { refreshScene } from '../../src/pixi-mvt';
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
    if (scene === 'watched') return createWatchedFrame(changedPercent);
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

/**
 * 1000 JSX sprites whose `width` follows a fractional model value. Setting
 * `width` is expensive, so the JSX runtime writes it only when its value
 * changes, keeping the last value it wrote to compare with. Keeping a
 * fractional number from one frame to the next is where V8 may box it in a
 * heap object, changed or not; the `synced` scene's `x`, `y` and `alpha` are
 * written every frame and never take this path.
 */
function createWatchedFrame(changedPercent: number): () => void {
    const count = 1000;
    const changedCount = Math.round((count * changedPercent) / 100);
    const widths: { width: number }[] = [];
    const root = new Container();
    for (let i = 0; i < count; i++) {
        const item = { width: 10.25 + (i % 50) };
        widths.push(item);
        root.addChild(jsx('sprite', { texture: Texture.WHITE, width: () => item.width }) as Sprite);
    }

    return () => {
        for (let i = 0; i < changedCount; i++) widths[i].width += 0.37;
        refreshScene(root);
    };
}
