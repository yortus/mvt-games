import { Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One measurable arm: a scenario, and which implementation runs it.
 *
 * Arms are meant to be run one per process, which is not a detail. Declared
 * side by side in one process, the first arm to run keeps the shared inline
 * caches and beats the second by more than 2x whichever way round the two are
 * declared - the vitest harness this replaces published exactly that artifact
 * as its result. One arm per process also lets the structural-wrapper arms
 * differ by whether the plugin was ever imported at all.
 *
 * `scripts/bench-scene-passes.ts` is the driver that does that.
 */
export interface BenchmarkArm {
    readonly scenario: string;
    readonly arm: string;
}

export interface BenchmarkResult extends BenchmarkArm {
    /** Microseconds per frame: the median of seven batches. */
    readonly usPerFrame: number;
    /** Method calls per frame, so arms can be compared like for like. */
    readonly callsPerFrame: number;
}

/** Every arm, in the order a full run reports them. */
export const benchmarkArms: readonly BenchmarkArm[] = [
    // A. The realistic shape: a large scene, few methods. Static.
    { scenario: 'sparse', arm: 'naive' },
    { scenario: 'sparse', arm: 'memo' },

    // B. Dense and static: every container carries a method, so pruning prunes
    // nothing and only the saved walk is left.
    { scenario: 'dense', arm: 'naive' },
    { scenario: 'dense', arm: 'memo' },

    // C. Dense and churning, which is the shape the memo loses on: the list is
    // rebuilt every frame and there is nothing to prune.
    { scenario: 'churn', arm: 'naive' },
    { scenario: 'churn', arm: 'memo' },

    // D. Whole subtrees attached and detached every frame, none carrying a method.
    { scenario: 'attach', arm: 'naive' },
    { scenario: 'attach', arm: 'memo' },

    // E. Dispatch against the incumbent: Pixi's own onRender list, driven
    // through its render group so that no renderer is needed.
    { scenario: 'dispatch', arm: 'onRender' },
    { scenario: 'dispatch', arm: 'memo' },

    // F. What the structural wrappers cost a tree that never calls either pass.
    // The arms differ only in whether this process ever imported the plugin.
    { scenario: 'mutation', arm: 'unpatched' },
    { scenario: 'mutation', arm: 'patched' },
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Builds one arm's scene, measures it, and reports microseconds per frame.
 *
 * A frame is one pass plus whatever churn the scenario applies. The result is
 * the median of seven batches, each batch sized from a warmup so that it runs
 * for roughly 100ms whether a frame costs 300us or half of one.
 */
export async function runBenchmarkArm(scenario: string, arm: string): Promise<BenchmarkResult> {
    // Imported dynamically, and only by the arms that want it: importing the
    // plugin is what installs the mixin, and the unpatched arm has to stay
    // unpatched.
    if (arm === 'memo' || arm === 'patched') {
        const module = await import('./scene-passes');
        refreshScene = module.refreshScene;
    }

    const frame = createFrame(scenario, arm);
    return {
        scenario,
        arm,
        usPerFrame: measure(frame),
        callsPerFrame: frame.callsPerFrame,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BATCHES = 7;
const BATCH_TARGET_MS = 100;
const WARMUP_MS = 50;

interface Frame {
    run(): void;
    readonly callsPerFrame: number;
}

interface Scene {
    readonly root: Container;
    readonly branches: Container[];
    readonly leaves: Container[];
}

let refreshScene: ((node: Container) => void) | undefined;

let sink = 0;

function bump(): void {
    sink++;
}

function createFrame(scenario: string, arm: string): Frame {
    const memo = arm === 'memo';
    if (scenario === 'sparse') return passFrame(20000, 200, 0, memo);
    if (scenario === 'dense') return passFrame(2000, 2000, 0, memo);
    if (scenario === 'churn') return passFrame(2000, 2000, 100, memo);
    if (scenario === 'attach') return attachFrame(memo);
    if (scenario === 'mutation') return mutationFrame();
    if (scenario === 'dispatch') return arm === 'onRender' ? onRenderFrame() : passFrame(2000, 2000, 0, true);
    throw new Error(`unknown scenario: ${scenario}`);
}

function measure(frame: Frame): number {
    const warmupEnd = performance.now() + WARMUP_MS;
    let warmupFrames = 0;
    while (performance.now() < warmupEnd) {
        frame.run();
        warmupFrames++;
    }

    // Size a batch from what the warmup managed, so a 300us arm and a 0.5us arm
    // both get a batch long enough to swamp timer resolution.
    const batchFrames = Math.max(1, Math.round((warmupFrames / WARMUP_MS) * BATCH_TARGET_MS));
    const batches: number[] = [];
    for (let batch = 0; batch < BATCHES; batch++) {
        const start = performance.now();
        for (let i = 0; i < batchFrames; i++) {
            frame.run();
        }
        batches.push(((performance.now() - start) * 1000) / batchFrames);
    }
    batches.sort((a, b) => a - b);
    return batches[(BATCHES - 1) / 2];
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
 * 100 method-free subtrees of 25 containers, detached and re-attached every frame.
 *
 * The point of the scenario: attaching a subtree costs the depth of the
 * ancestor chain rather than the size of the subtree, and a method-free subtree
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

function requireRefreshScene(): (node: Container) => void {
    if (refreshScene === undefined) throw new Error('this arm needs the plugin, which was not imported');
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

/** Swaps `count` leaves for fresh ones carrying a method, which dirties the memo. */
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

export { sink };
