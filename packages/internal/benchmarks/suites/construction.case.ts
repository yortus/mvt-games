import { Container } from 'pixi.js';
import { refreshView, setRefresh } from '@mvtjs/pixi';
import { readParams, report, timeFrames } from '../harness/measure';
import { createPoolFrame } from '../shared/pool-scene';
import { createSyncedScene, type Approach } from '../shared/synced-scene';

// Measured file for the `construction` suite.
//
// scenario `build`: the time spent on one Pixi container over its whole life.
//   Each case builds the container and its model record, brings it up to
//   date once, and destroys it, 1000 at a time. `container-only` is a bare
//   `new Container()` and `destroy()`, for scale. `pixi-3d-hand-written` and
//   `pixi-3d-jsx` build PixiJS 3D groups that follow a record's x, y and z,
//   to measure the performance cost of a 3D element.
// scenario `pool`: short-lived items reused from a pool, or built and
//   destroyed; see `createPoolFrame`.

const params = readParams();
const scenario = String(params.scenario);
const approach = String(params.approach);

if (scenario === 'build') {
    const count = 1000;
    const frame = approach === 'container-only'
        ? buildBareContainers(count)
        : approach.startsWith('pixi-3d-')
            ? await buildGroups3d(approach === 'pixi-3d-jsx', count)
            : buildSyncedScenes(approach as Approach, count);
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

/** Returns a frame that builds PixiJS 3D groups, each following a model record's x, y and z, refreshes them once, and destroys them. */
async function buildGroups3d(isJsx: boolean, count: number): Promise<() => void> {
    // Imported only here, so the 2D cases never load PixiJS 3D, and run just as they did before it was added
    const [{ Container3D }, { jsx: pixi3dJsx }] = await Promise.all([import('@pixi/3d'), import('@mvtjs/pixi-3d')]);
    return () => {
        const root = new Container3D();
        for (let i = 0; i < count; i++) {
            const item = { x: i, y: i, z: i };
            if (isJsx) {
                root.addChild(pixi3dJsx('group', { x: () => item.x, y: () => item.y, z: () => item.z }));
                continue;
            }
            const group = new Container3D();
            setRefresh(group, () => {
                group.x = item.x;
                group.y = item.y;
                group.z = item.z;
            });
            root.addChild(group);
        }
        refreshView(root);
        root.destroy({ children: true });
    };
}

function buildSyncedScenes(sceneApproach: Approach, count: number): () => void {
    const polled = sceneApproach === 'hand-written' || sceneApproach === 'jsx';
    return () => {
        const scene = createSyncedScene({ approach: sceneApproach, count, dynamicProperties: 3, changedPercent: 0 });
        // The first refresh is part of a container's cost. Signals and events
        // bring their views up to date as they are built.
        if (polled) refreshView(scene.root);
        scene.dispose();
    };
}
