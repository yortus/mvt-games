import { Container } from 'pixi.js';
import { refreshScene } from '../../src/pixi-mvt';
import { readParams, report, timeFrames } from '../harness/measure';
import { createPoolFrame } from '../shared/pool-scene';
import { createSyncedScene, type Approach } from '../shared/synced-scene';

// Measured file for the `construction` suite.
//
// scenario `build`: the cost of one Pixi container over its whole life: build
//   it and its model record, bring it up to date once, and destroy it. Built
//   1000 at a time. `container-only` is a bare `new Container()` and
//   `destroy()`, for scale.
// scenario `pool`: short-lived items reused from a pool, or built and
//   destroyed; see `createPoolFrame`.

const params = readParams();
const scenario = String(params.scenario);
const approach = String(params.approach);

if (scenario === 'build') {
    const count = 1000;
    const frame = approach === 'container-only' ? buildBareContainers(count) : buildSyncedScenes(approach as Approach, count);
    report({ usPerContainer: timeFrames(frame) / count });
}
else {
    report({ usPerFrame: timeFrames(createPoolFrame(approach, Number(params.spawnPerFrame))) });
}

// ---------------------------------------------------------------------------
// Build and destroy
// ---------------------------------------------------------------------------

function buildBareContainers(count: number): () => void {
    return () => {
        const root = new Container();
        for (let i = 0; i < count; i++) root.addChild(new Container());
        root.destroy({ children: true });
    };
}

function buildSyncedScenes(sceneApproach: Approach, count: number): () => void {
    const polled = sceneApproach === 'hand-written' || sceneApproach === 'jsx';
    return () => {
        const scene = createSyncedScene({ approach: sceneApproach, count, dynamicProperties: 3, changedPercent: 0 });
        // The first refresh is part of a container's cost. Signals and events
        // bring their views up to date as they are built.
        if (polled) refreshScene(scene.root);
        scene.dispose();
    };
}
