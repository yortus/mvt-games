import { Container } from 'pixi.js';
import { bench, describe } from 'vitest';
import { createSceneScheduler } from './scene-scheduler';
import type { SceneScheduler, SchedulerStrategyKind } from './mvt-types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

// Hook bodies are deliberately trivial. What is being measured is call-list
// maintenance and dispatch, not the work a real view would do.
let sink = 0;

function noopUpdate(deltaMs: number): void {
    sink += deltaMs;
}

function noopRefresh(): void {
    sink++;
}

function hooked(): Container {
    const container = new Container();
    container.onUpdate = noopUpdate;
    container.onRefresh = noopRefresh;
    return container;
}

interface Scene {
    readonly scheduler: SceneScheduler;
    /** Containers that new leaves get attached to. */
    readonly branches: Container[];
    /** Leaves eligible for removal, used as a ring buffer. */
    readonly leaves: Container[];
    cursor: number;
}

/**
 * Builds a tree of roughly `size` containers, four levels deep, every one of
 * them carrying both hooks.
 */
function createScene(size: number, strategy: SchedulerStrategyKind): Scene {
    const root = hooked();
    const branches: Container[] = [root];
    const leaves: Container[] = [];

    const branchCount = Math.max(4, Math.floor(size / 32));
    for (let i = 0; i < branchCount; i++) {
        const branch = hooked();
        root.addChild(branch);
        branches.push(branch);
        const subBranch = hooked();
        branch.addChild(subBranch);
        branches.push(subBranch);
    }

    while (leaves.length + branches.length < size) {
        const leaf = hooked();
        branches[leaves.length % branches.length].addChild(leaf);
        leaves.push(leaf);
    }

    return {
        scheduler: createSceneScheduler(root, { strategy }),
        branches,
        leaves,
        cursor: 0,
    };
}

/** One frame: churn the scene, then run both passes. */
function tick(scene: Scene, churn: number): void {
    for (let i = 0; i < churn; i++) {
        const index = scene.cursor % scene.leaves.length;
        scene.cursor++;
        const old = scene.leaves[index];
        old.removeFromParent();
        const replacement = hooked();
        scene.branches[index % scene.branches.length].addChild(replacement);
        scene.leaves[index] = replacement;
    }
    scene.scheduler.update(16);
    scene.scheduler.refresh();
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

const SCENE_SIZE = 2000;
const STRATEGIES: SchedulerStrategyKind[] = ['rebuild', 'incremental'];

// A scene that never changes shape. The rebuild strategy is never dirty here,
// so this measures pure dispatch and the two should be indistinguishable.
describe(`static scene, ${SCENE_SIZE} containers`, () => {
    for (const strategy of STRATEGIES) {
        const scene = createScene(SCENE_SIZE, strategy);
        bench(strategy, () => {
            tick(scene, 0);
        });
    }
});

// A handful of entities appearing and disappearing, as in a game with a few
// projectiles in flight. The rebuild strategy pays a full walk of all 2000
// containers to account for five of them.
describe(`light churn, 5 swaps per tick, ${SCENE_SIZE} containers`, () => {
    for (const strategy of STRATEGIES) {
        const scene = createScene(SCENE_SIZE, strategy);
        bench(strategy, () => {
            tick(scene, 5);
        });
    }
});

// Sustained heavy churn, as in a bullet-hell or particle-driven scene.
describe(`heavy churn, 100 swaps per tick, ${SCENE_SIZE} containers`, () => {
    for (const strategy of STRATEGIES) {
        const scene = createScene(SCENE_SIZE, strategy);
        bench(strategy, () => {
            tick(scene, 100);
        });
    }
});

// The cost of the structural wrappers themselves, with no scheduler attached,
// to show what the mixin adds to an ordinary Pixi scene that never uses it.
describe('structural mutation, unmanaged tree', () => {
    const root = new Container();
    const parents: Container[] = [];
    for (let i = 0; i < 64; i++) {
        const parent = new Container();
        root.addChild(parent);
        parents.push(parent);
    }
    bench('addChild + removeFromParent x100', () => {
        for (let i = 0; i < 100; i++) {
            const child = new Container();
            parents[i % parents.length].addChild(child);
            child.removeFromParent();
        }
    });
});

export { sink };
