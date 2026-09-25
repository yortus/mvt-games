import process from 'node:process';
import { Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `scene-passes` suite: the cost of `refreshScene`
// itself, against a plain recursive walk (`naive`) and Pixi's own `onRender`.
// A frame is one pass plus whatever changes the scenario makes to the tree.
//
// The plugin is imported dynamically, and only by the approaches that use it:
// importing it is what installs the mixin, and the `unpatched` approach has to
// stay unpatched. The bundle keeps that import lazy.

const params = readParams();
const scenario = String(params.scenario);
const approach = String(params.approach);

let refreshScene: ((node: Container) => void) | undefined;
let skipDescendants: symbol | undefined;

// Counts `onRefresh` calls. Read after timing, so the engine cannot drop their work.
let sink = 0;

function bump(): void {
    sink++;
}

if (approach !== 'naive' && approach !== 'onRender' && approach !== 'unpatched') {
    const plugin = await import('../../src/pixi-mvt');
    refreshScene = plugin.refreshScene;
    skipDescendants = plugin.SKIP_DESCENDANTS as unknown as symbol;
}
else if (Object.getOwnPropertyDescriptor(Container.prototype, 'onRefresh') !== undefined) {
    throw new Error('the plugin was installed in an approach that must not have it');
}

const frame = createFrame(scenario, approach);
report({ usPerFrame: timeFrames(frame.run), callsPerFrame: frame.callsPerFrame });
if (sink < 0) process.stdout.write('\n');

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

interface Frame {
    run(): void;
    readonly callsPerFrame: number;
}

interface Scene {
    readonly root: Container;
    readonly branches: Container[];
    readonly leaves: Container[];
}

function createFrame(scenario: string, approach: string): Frame {
    const memo = approach === 'memo';
    if (scenario === 'skip') return skipFrame(approach);
    if (scenario === 'sparse') return passFrame(20000, 200, 0, memo);
    if (scenario === 'dense') return approach === 'onRender' ? onRenderFrame() : passFrame(2000, 2000, 0, memo);
    if (scenario === 'churn') return passFrame(2000, 2000, 100, memo);
    if (scenario === 'attach') return attachFrame(memo);
    if (scenario === 'mutation') return mutationFrame();
    throw new Error(`unknown scenario: ${scenario}`);
}

function passFrame(size: number, withMethods: number, swapsPerFrame: number, memo: boolean): Frame {
    const scene = buildScene(size, withMethods);
    const pass = memo ? requireRefreshScene() : naiveRefresh;
    let cursor = 0;
    return {
        callsPerFrame: withMethods,
        run() {
            if (swapsPerFrame > 0) cursor = churn(scene, swapsPerFrame, cursor);
            pass(scene.root);
        },
    };
}

/**
 * 100 subtrees of 25 containers, none of which has an `onRefresh`, detached
 * and re-attached every frame.
 *
 * The point of the scenario: attaching a subtree costs the depth of the
 * ancestor chain rather than the size of the subtree, and a subtree with no `onRefresh`
 * whose own shape never changes keeps its cached answer throughout.
 */
function attachFrame(memo: boolean): Frame {
    const pass = memo ? requireRefreshScene() : naiveRefresh;
    const root = new Container();
    root.onRefresh = bump;
    const subtrees: Container[] = [];
    for (let i = 0; i < 100; i++) {
        const subtree = new Container();
        let cursor: Container = subtree;
        for (let depth = 0; depth < 24; depth++) {
            const child = new Container();
            cursor.addChild(child);
            cursor = child;
        }
        root.addChild(subtree);
        subtrees.push(subtree);
    }

    return {
        callsPerFrame: 1,
        run() {
            for (let i = 0; i < subtrees.length; i++) {
                subtrees[i].removeFromParent();
            }
            for (let i = 0; i < subtrees.length; i++) {
                root.addChild(subtrees[i]);
            }
            pass(root);
        },
    };
}

function onRenderFrame(): Frame {
    const scene = buildScene(2000, 2000);
    // Move the methods over to Pixi's own mechanism, then drive its render
    // group directly. `runOnRender` only forwards the renderer to the callback,
    // so passing nothing measures dispatch and nothing else.
    reassignToOnRender(scene.root);
    scene.root.enableRenderGroup();
    const renderGroup = scene.root.renderGroup;
    const renderer = undefined as unknown as Renderer;

    return {
        callsPerFrame: 2000,
        run() {
            renderGroup.runOnRender(renderer);
        },
    };
}

/** Structural churn on a tree nothing ever drives, which is what most trees are. */
function mutationFrame(): Frame {
    const root = new Container();
    const parents: Container[] = [];
    for (let i = 0; i < 64; i++) {
        const parent = new Container();
        root.addChild(parent);
        parents.push(parent);
    }

    return {
        callsPerFrame: 0,
        run() {
            for (let i = 0; i < 100; i++) {
                const child = new Container();
                parents[i % parents.length].addChild(child);
                child.removeFromParent();
            }
        },
    };
}

/**
 * 100 groups of 100 containers, each container with an `onRefresh` that reads a
 * model value; 90 of the groups are inactive. `skip`: an inactive group's own
 * `onRefresh` returns `SKIP_DESCENDANTS`, so its containers' methods do not run.
 * `hidden`: inactive groups are only hidden (`visible = false`), so every
 * `onRefresh` still runs.
 */
function skipFrame(approach: string): Frame {
    const pass = requireRefreshScene();
    const skip = approach === 'skip';
    const root = new Container();
    const model = { x: 0 };
    let calls = 0;
    for (let g = 0; g < 100; g++) {
        const group = new Container();
        const active = g < 10;
        if (!active && skip) group.onRefresh = () => skipDescendants as never;
        if (!active) group.visible = false;
        for (let i = 0; i < 100; i++) {
            const leaf = new Container();
            leaf.onRefresh = () => {
                leaf.x = model.x;
            };
            group.addChild(leaf);
        }
        calls += skip && !active ? 1 : 100;
        root.addChild(group);
    }
    return {
        callsPerFrame: calls,
        run() {
            model.x++;
            pass(root);
        },
    };
}

function requireRefreshScene(): (node: Container) => void {
    if (refreshScene === undefined) throw new Error('this approach needs the plugin, which was not imported');
    return refreshScene;
}

/** A tree of `size` containers, three levels deep, `withMethods` of them carrying one. */
function buildScene(size: number, withMethods: number): Scene {
    const root = new Container();
    const branches: Container[] = [root];
    const leaves: Container[] = [];

    const branchCount = Math.max(4, Math.floor(size / 32));
    for (let i = 0; i < branchCount; i++) {
        const branch = new Container();
        root.addChild(branch);
        branches.push(branch);
        const subBranch = new Container();
        branch.addChild(subBranch);
        branches.push(subBranch);
    }
    while (leaves.length + branches.length < size) {
        const leaf = new Container();
        branches[leaves.length % branches.length].addChild(leaf);
        leaves.push(leaf);
    }

    // Spread the methods through the leaves rather than clustering them, so
    // pruning has to work for its result.
    const stride = Math.max(1, Math.floor(leaves.length / withMethods));
    let placed = 0;
    for (let i = 0; i < leaves.length && placed < withMethods; i += stride) {
        leaves[i].onRefresh = bump;
        placed++;
    }

    return { root, branches, leaves };
}

/** Swaps `count` leaves for fresh ones that have an `onRefresh`, which dirties the memo. */
function churn(scene: Scene, count: number, cursor: number): number {
    let at = cursor;
    for (let i = 0; i < count; i++) {
        const index = at % scene.leaves.length;
        at++;
        scene.leaves[index].removeFromParent();
        const replacement = new Container();
        replacement.onRefresh = bump;
        scene.branches[index % scene.branches.length].addChild(replacement);
        scene.leaves[index] = replacement;
    }
    return at;
}

/** A recursive walk with no index and no memo, which is the baseline to beat. */
function naiveRefresh(node: Container): void {
    const method = node.onRefresh;
    if (method !== undefined) method();
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        naiveRefresh(children[i]);
    }
}

function reassignToOnRender(node: Container): void {
    if (node.onRefresh !== undefined) {
        node.onRefresh = undefined;
        node.onRender = bump;
    }
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        reassignToOnRender(children[i]);
    }
}
