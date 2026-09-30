import type { RefreshMethod, SceneNode, UpdateMethod } from './scene-node';
import { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How to walk a renderer's tree: all the scene passes need to know about its nodes. */
export interface SceneTree<N> {
    /** The node's children, in order. Read only when a memoised walk is rebuilt. */
    readonly children: (node: N) => ArrayLike<N>;
    /** The node's parent, if it has one. Read once per node per scene pass. */
    readonly parent: (node: N) => N | null | undefined;
    /** Names a node in error and warning messages. */
    readonly describe: (node: N) => string;
    /**
     * Called at the start of every scene pass, with the node it starts from,
     * before its memoised walk is read. For a renderer that learns of changes
     * to its tree only when it asks (the DOM, through a `MutationObserver`),
     * this is the moment to ask. Renderers that report changes as they
     * happen leave it out.
     */
    readonly beforeScenePass?: (node: N) => void;
}

/** The scene passes over one kind of tree, and what a renderer's code needs to keep them correct. */
export interface ScenePasses<N> {
    /**
     * Runs every `onUpdate` in `node`'s subtree, each exactly once, calling a
     * node before any of its descendants. Sibling order is unspecified.
     *
     * `node` can be any node, at any time: a whole scene, a single view under
     * test, or one branch of a scene whose root is also updated.
     * Nothing here touches a renderer or a ticker, which is what lets a scene
     * be stepped in a test, fast-forwarded, or stepped to produce a thumbnail.
     *
     * The walk for `node` is memoised on `node` itself and invalidated by tree
     * mutation, so a static scene pays a list walk and nothing else. A method
     * may return `SKIP_DESCENDANTS` to skip its descendants this frame; the
     * node itself has already run, so it can stop skipping next frame. In the
     * update scene pass that freezes a subtree's state advance, so it is an
     * opt-in for deliberately frozen subtrees rather than a routine tool.
     */
    readonly updateScene: (node: N, deltaMs: number) => void;
    /**
     * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling a
     * node before any of its descendants. Sibling order is unspecified.
     *
     * The refresh half of `updateScene`, with the same memo and ordering.
     * Nothing gates on visibility, so a view is free to set its own
     * visibility; to skip refreshing its descendants (a hidden or absent
     * subtree) it says so explicitly by returning `SKIP_DESCENDANTS`.
     */
    readonly refreshScene: (node: N) => void;
    /**
     * Records that `node`'s children changed: clears both memoised walks from
     * `node` up to the root. A renderer's code calls it from every operation that adds
     * or removes a child, however the tree does that.
     */
    readonly invalidate: (node: N) => void;
    /**
     * Adds the `onUpdate` and `onRefresh` accessors, and the fields behind
     * them, to a node prototype. Assigning a method through them invalidates
     * the memoised walks above the node. Must run before any node of that
     * prototype is given a method: one assigned earlier becomes an own
     * property that shadows the accessors, and loses every invalidation.
     */
    readonly installMethods: (prototype: object) => void;
}

/**
 * The memoised walk for a node's subtree, shared by both scene passes: a
 * preorder list of the nodes that carry the scene pass's method, their
 * methods, and a skip table, so a returned `SKIP_DESCENDANTS` prunes a
 * subtree in one step. `skip[i]` is the list index just past entry `i`'s
 * subtree, which is contiguous because the list is preorder.
 *
 * The three travel together on purpose. A skip table or a method cache that
 * outlived the list it indexes would be a second source of truth about the
 * tree; bundled, they are derived from the list and invalidated with it.
 */
export interface SubtreeInfo<N> {
    readonly list: N[];
    /**
     * Each listed node's method, read when the list was built, so the loop
     * calls it without reading the node's accessor (proposal 012 section 2).
     * Assigning any method during a scene pass sends the rest of that scene
     * pass back to reading them live; see `invokeSubtreeMethods`.
     */
    readonly methods: SceneMethod[];
    readonly skip: Int32Array;
}

/**
 * The fields the scene passes keep on every node of a renderer, alongside its
 * methods. A renderer's code declares them on its node type (Pixi's, through
 * `PixiMixins.Container`) so the memo is typed; `installMethods` adds them.
 */
export interface SceneMemoFields<N> {
    /** Backing field for `onUpdate`. */
    _mvtOnUpdate: UpdateMethod | undefined;
    /** Backing field for `onRefresh`. */
    _mvtOnRefresh: RefreshMethod | undefined;
    /** Does this subtree hold any `onUpdate`? `undefined` = dirty. */
    _mvtHasUpdate: boolean | undefined;
    /** Update walk for this subtree. `undefined` = dirty. */
    _mvtUpdate: SubtreeInfo<N> | undefined;
    /** Does this subtree hold any `onRefresh`? `undefined` = dirty. */
    _mvtHasRefresh: boolean | undefined;
    /** Refresh walk for this subtree. `undefined` = dirty. */
    _mvtRefresh: SubtreeInfo<N> | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The scene passes over one kind of tree. See the pixi-mvt design notes for
 * how the memoised walk works and what was measured; nothing here is specific
 * to Pixi.
 *
 * Each call makes its own passes, re-entry guard and invalidation climbs, one
 * per kind of node. Nodes of different kinds never share a tree, so they
 * never need to share them.
 */
export function createScenePasses<N extends SceneNode>(tree: SceneTree<N>): ScenePasses<N> {
    // Nodes with a scene pass in flight, so a method that re-enters the scene
    // pass it is already inside is caught rather than silently running the
    // list twice. Starting a scene pass on a different node from a method is
    // fine, and is how a view refreshes something it has just built.
    const activeUpdates: N[] = [];
    const activeRefreshes: N[] = [];

    return { updateScene, refreshScene, invalidate, installMethods };

    function updateScene(node: N, deltaMs: number): void {
        tree.beforeScenePass?.(node);
        enter(activeUpdates, node, 'updateScene');
        try {
            const memo = memoOf(node);
            let info = memo._mvtUpdate;
            if (info === undefined) {
                if (DEV) assertNoShadowedMethods(node);
                info = buildSubtreeInfo(node, UPDATE);
                memo._mvtUpdate = info;
            }
            invokeSubtreeMethods(info, node, UPDATE, deltaMs);
        }
        finally {
            activeUpdates.pop();
        }
    }

    function refreshScene(node: N): void {
        tree.beforeScenePass?.(node);
        enter(activeRefreshes, node, 'refreshScene');
        try {
            const memo = memoOf(node);
            let info = memo._mvtRefresh;
            if (info === undefined) {
                if (DEV) assertNoShadowedMethods(node);
                info = buildSubtreeInfo(node, REFRESH);
                memo._mvtRefresh = info;
            }
            invokeSubtreeMethods(info, node, REFRESH, 0);
        }
        finally {
            activeRefreshes.pop();
        }
    }

    /** Invalidates both kinds, which is what every structural change needs. */
    function invalidate(node: N): void {
        invalidateUpdate(node);
        invalidateRefresh(node);
    }

    /**
     * Climbs to the root clearing the update memo, stopping at the first node
     * already dirty for that kind.
     *
     * The short-circuit relies on a per-kind invariant - a node dirty for kind
     * K implies all its ancestors are dirty for K - which this climb maintains
     * inductively. After the first mutation of a frame the chain above it is
     * already dirty, so every later mutation stops on its first comparison,
     * and a tree no scene pass ever runs on is permanently dirty and costs one
     * comparison per mutation.
     */
    function invalidateUpdate(node: N): void {
        let cursor: N | null | undefined = node;
        while (cursor) {
            const memo = memoOf(cursor);
            if (memo._mvtHasUpdate === undefined && memo._mvtUpdate === undefined) return;
            // Both fields of a kind are cleared together: they are maintained in
            // lockstep and the short-circuit above tests both.
            memo._mvtHasUpdate = undefined;
            memo._mvtUpdate = undefined;
            cursor = tree.parent(cursor);
        }
    }

    /** The refresh half of {@link invalidateUpdate}. */
    function invalidateRefresh(node: N): void {
        let cursor: N | null | undefined = node;
        while (cursor) {
            const memo = memoOf(cursor);
            if (memo._mvtHasRefresh === undefined && memo._mvtRefresh === undefined) return;
            memo._mvtHasRefresh = undefined;
            memo._mvtRefresh = undefined;
            cursor = tree.parent(cursor);
        }
    }

    /**
     * Copies the method accessors and memo fields onto `prototype`, with
     * `Object.defineProperties`, accessors intact.
     *
     * The methods are accessors rather than plain fields because assigning
     * one has to invalidate the memoised walks above the node. Without that,
     * giving an already-attached node a method would leave it out of a list
     * built before it carried one.
     *
     * This is the one place the scene passes use `this`, which the style
     * guide otherwise rules out: a prototype accessor has no other way to
     * reach its instance. Methods themselves are invoked as plain calls with
     * no receiver, so a view's method stays an ordinary closure.
     */
    function installMethods(prototype: object): void {
        const source: SceneMemoFields<N> & SceneNode & ThisType<N & SceneMemoFields<N>> = {
            _mvtOnUpdate: undefined,
            _mvtOnRefresh: undefined,
            _mvtHasUpdate: undefined,
            _mvtUpdate: undefined,
            _mvtHasRefresh: undefined,
            _mvtRefresh: undefined,

            get onUpdate(): UpdateMethod | undefined {
                return this._mvtOnUpdate;
            },
            set onUpdate(method: UpdateMethod | undefined) {
                if (this._mvtOnUpdate === method) return;
                this._mvtOnUpdate = method;
                methodAssignments++;
                invalidateUpdate(this);
            },

            get onRefresh(): RefreshMethod | undefined {
                return this._mvtOnRefresh;
            },
            set onRefresh(method: RefreshMethod | undefined) {
                if (this._mvtOnRefresh === method) return;
                this._mvtOnRefresh = method;
                methodAssignments++;
                invalidateRefresh(this);
            },
        };
        Object.defineProperties(prototype, Object.getOwnPropertyDescriptors(source));
    }

    function enter(active: N[], node: N, name: string): void {
        for (let i = 0; i < active.length; i++) {
            if (active[i] !== node) continue;
            throw new Error(
                `[mvt] ${name}() was called re-entrantly on the same node, ${tree.describe(node)}. `
                + 'A method cannot start the scene pass it is already inside; start one on a different subtree.',
            );
        }
        active.push(node);
    }

    /**
     * Walks the memoised list, calling each node's method before its
     * descendants. A method returning `SKIP_DESCENDANTS` skips its subtree in
     * one step via the skip table, having already run itself, so it can stop
     * skipping on a later frame.
     *
     * Methods are called from the list's cache rather than read through each
     * node's accessor: a scene of mixed node shapes makes that read
     * megamorphic, and caching made refresh 30-40% cheaper on such scenes
     * (proposal 012 section 2). A method assigned or cleared during the scene
     * pass (a `<List>` building slots, a view silencing a sibling) bumps
     * `methodAssignments`, and from then on this scene pass reads methods live,
     * so a method cleared earlier in the scene pass never runs later in it.
     */
    function invokeSubtreeMethods(info: SubtreeInfo<N>, node: N, pass: Pass, deltaMs: number): void {
        const list = info.list;
        const methods = info.methods;
        const skip = info.skip;
        const assignmentsAtStart = methodAssignments;
        for (let i = 0; i < list.length;) {
            const listed = list[i];
            // Detached by a method earlier in this scene pass: skip its whole
            // subtree, whose internal parent links are still intact. The node
            // the scene pass started from may have no parent, and is exempt.
            if (listed !== node && !tree.parent(listed)) {
                i = skip[i];
                continue;
            }
            const method = methodAssignments === assignmentsAtStart
                ? methods[i]
                : pass === UPDATE ? listed.onUpdate : listed.onRefresh;
            if (method !== undefined && method(deltaMs) === SKIP_DESCENDANTS) {
                i = skip[i];
                continue;
            }
            i++;
        }
    }

    /**
     * Builds the memoised {@link SubtreeInfo} for `node`'s subtree: the
     * preorder list of nodes carrying the scene pass's method, their methods,
     * and the skip table over them.
     */
    function buildSubtreeInfo(node: N, pass: Pass): SubtreeInfo<N> {
        const list: N[] = [];
        const methods: SceneMethod[] = [];
        const ends: number[] = [];
        collectSubtreeMethods(node, pass, list, methods, ends);
        return { list, methods, skip: Int32Array.from(ends) };
    }

    /**
     * Appends `node`'s subtree in preorder, skipping subtrees that hold no
     * method of this scene pass, and fills the skip table.
     *
     * `ends` grows in lockstep with `list` and records, for each listed node,
     * the list length once its whole subtree is collected - the index just
     * past its subtree, since preorder makes a subtree contiguous.
     */
    function collectSubtreeMethods(node: N, pass: Pass, list: N[], methods: SceneMethod[], ends: number[]): void {
        // Read here rather than through a shared helper: measured, V8 did not
        // inline one, and the rebuild of a churning scene was 25% slower.
        const method: SceneMethod | undefined = pass === UPDATE ? node.onUpdate : node.onRefresh;
        let selfIndex = -1;
        if (method !== undefined) {
            selfIndex = list.length;
            list.push(node);
            methods.push(method);
            ends.push(0); // Placeholder, overwritten once this subtree is collected.
        }
        const children = tree.children(node);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (has(child, pass)) collectSubtreeMethods(child, pass, list, methods, ends);
        }
        if (selfIndex !== -1) ends[selfIndex] = list.length;
    }

    /**
     * Does this subtree hold any method of this scene pass?
     *
     * Deliberately visits every child instead of stopping at the first that
     * has one. Visiting them all is what caches them all, and that cache is
     * what makes a later prune a single field read. An early exit would
     * quietly turn every rebuild back into a walk of the whole subtree.
     */
    function has(node: N, pass: Pass): boolean {
        const memo = memoOf(node);
        const cached = pass === UPDATE ? memo._mvtHasUpdate : memo._mvtHasRefresh;
        if (cached !== undefined) return cached;
        if (DEV) assertNoShadowedMethods(node);
        let found = (pass === UPDATE ? node.onUpdate : node.onRefresh) !== undefined;
        const children = tree.children(node);
        for (let i = 0; i < children.length; i++) {
            if (has(children[i], pass)) found = true;
        }
        if (pass === UPDATE) memo._mvtHasUpdate = found;
        else memo._mvtHasRefresh = found;
        return found;
    }

    /**
     * Dev-only guard against an update or refresh method stored as an own
     * property, which shadows the prototype accessor for the life of that node
     * and silently loses every later invalidation. It cannot happen through
     * assignment once `installMethods` has run; it can still happen through
     * `Object.defineProperty`, or a method assigned before it ran.
     */
    function assertNoShadowedMethods(node: N): void {
        if (!Object.hasOwn(node, 'onUpdate') && !Object.hasOwn(node, 'onRefresh')) return;
        throw new Error(
            `[mvt] node ${tree.describe(node)} carries onUpdate/onRefresh as an own property, `
            + 'which shadows the prototype accessor and loses invalidation. '
            + 'Assign the method instead of defining the property.',
        );
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * An update or refresh method, as the loop calls it: with `deltaMs`, which a
 * refresh method ignores. One call site for both scene passes.
 */
type SceneMethod = (deltaMs: number) => typeof SKIP_DESCENDANTS | void;

// Which scene pass a shared helper is serving. A tiny discriminator keeps the
// collection, the presence cache and the invoke loop as one implementation
// each.
const UPDATE = 0;
const REFRESH = 1;
type Pass = typeof UPDATE | typeof REFRESH;

// Vite replaces `import.meta.env.DEV` at build time. Plain Node - which is how
// the benchmark harness runs - has no `import.meta.env` at all, so it is read
// defensively here rather than assumed.
const DEV = import.meta.env?.DEV === true;

/**
 * How many times any node's `onUpdate` or `onRefresh` has been assigned, by
 * any tree. A scene pass records it on entry and, if it has changed, reads
 * methods live for the rest of that scene pass. Shared by every tree, so a
 * method that assigns a method on another kind of node is safe too.
 */
let methodAssignments = 0;

function memoOf<N>(node: N): SceneMemoFields<N> {
    return node as unknown as SceneMemoFields<N>;
}
