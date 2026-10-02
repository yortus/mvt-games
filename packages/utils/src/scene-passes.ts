import { sceneCounter } from './scene-counter';
import type { RefreshMethod, UpdateMethod } from './scene-methods';
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
     * Records that `node`'s children changed: clears both memoised walks from
     * `node` up to the root. A renderer's code calls it from every operation that adds
     * or removes a child, however the tree does that.
     */
    readonly invalidate: (node: N) => void;
    /**
     * Adds the defaults of the scene passes' private fields to a node
     * prototype, so a node only gains own properties for what is written to
     * it, and every node of that prototype leads to these passes'
     * invalidation climbs. A renderer's code runs it once, at module load.
     */
    readonly installFieldDefaults: (prototype: object) => void;
    /**
     * Ticks a subtree, which is one turn of the ticker's loop for a scene: the
     * update scene pass with `deltaMs`, then the refresh scene pass. A host
     * calls it once per frame on its whole scene, after advancing its models.
     * It is the only way to run the scene passes.
     *
     * ```ts
     * tickScene({ root: app.stage, deltaMs });            // a whole tick
     * tickScene({ root, deltaMs, only: 'update' });       // the update scene pass alone
     * tickScene({ root, only: 'refresh' });               // the refresh scene pass alone
     * ```
     *
     * `only` is for a caller that has to step the two apart, such as many
     * updates and then one refresh. A refresh alone takes no `deltaMs`, and
     * leaving `deltaMs` out otherwise is a type error, not a refresh. In dev
     * builds, a `deltaMs` that is not a finite number throws; a negative one
     * is allowed.
     *
     * `root` can be any node, at any time: a whole scene, a single view under
     * test, or one branch of a scene whose root is also ticked. Nothing here
     * touches a renderer or a ticker, which is what lets a scene be stepped in
     * a test, fast-forwarded, or stepped to produce a thumbnail.
     *
     * Each scene pass runs every method of its kind in the subtree exactly
     * once, a node's before any of its descendants'; sibling order is
     * unspecified. A method may return `SKIP_DESCENDANTS` to skip its
     * descendants for that scene pass. Nothing gates on visibility. The
     * refresh scene pass also refreshes what its methods attach, or give a
     * refresh method, before it returns, so nothing is drawn unrefreshed.
     */
    readonly tickScene: (options: TickSceneOptions<N>) => void;
    /**
     * `setTickMethods`, typed to this kind of node, so a renderer's code can
     * export it for views: passing anything but one of its nodes is then a
     * type error.
     */
    readonly setTickMethods: (node: N, methods: TickMethods) => void;
}

/** What `tickScene` runs: a whole tick, or one of its two scene passes. */
export type TickSceneOptions<N> = TickWithUpdate<N> | TickWithoutUpdate<N>;

/** A tick that runs the update scene pass: both scene passes, or `only` the update. */
interface TickWithUpdate<N> {
    /** The subtree to tick. */
    readonly root: N;
    /** How far to advance presentation state, in the update scene pass. */
    readonly deltaMs: number;
    /** `'update'` runs the update scene pass alone; left out, both run. */
    readonly only?: 'update';
}

/** The refresh scene pass alone, which advances nothing, so takes no `deltaMs`. */
interface TickWithoutUpdate<N> {
    /** The subtree to refresh. */
    readonly root: N;
    readonly only: 'refresh';
    readonly deltaMs?: undefined;
}

/**
 * What a node does on each tick, as `setTickMethods` takes it: its update
 * method, its refresh method, or both. A member left out is left as it is;
 * one given as `undefined` is cleared.
 */
interface TickMethods {
    readonly update?: UpdateMethodOrWrapper | undefined;
    readonly refresh?: RefreshMethodOrWrapper | undefined;
}

/**
 * An update method as `setTickMethods` takes it: one that declares a second
 * parameter is given the update method it replaces.
 */
type UpdateMethodOrWrapper = (deltaMs: number, previous: UpdateMethod | undefined) => typeof SKIP_DESCENDANTS | void;

/**
 * A refresh method as `setTickMethods` takes it: one that declares a
 * parameter is given the refresh method it replaces.
 */
type RefreshMethodOrWrapper = (previous: RefreshMethod | undefined) => typeof SKIP_DESCENDANTS | void;

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
interface SubtreeWalk<N> {
    readonly list: N[];
    /**
     * Each listed node's method, read when the list was built, so the loop
     * calls it without reading the node's field, a read that a scene of
     * mixed node shapes makes megamorphic.
     * Assigning any method during a scene pass sends the rest of that scene
     * pass back to reading them live; see `invokeSubtreeMethods`.
     */
    readonly methods: SceneMethod[];
    readonly skip: Int32Array;
    /**
     * Refresh walks only: what the last walk elided at each entry (the entry,
     * its descendants, or both) and why, tagged with its scene pass's id (see
     * `encodeElision`). An entry with no elision for that scene pass ran, and
     * the walk stepped to the next. The walk is otherwise deterministic, so
     * the elisions are enough to replay which entries it ran, which
     * `catchUpRefresh` does only if the tree changed during that scene pass.
     * Recording only elisions keeps the common path of the loop free of any
     * store.
     */
    readonly elisions: Int32Array | undefined;
}

/**
 * Everything the scene passes keep for one node: its two methods, and what
 * they cache about its subtree, as private `_mvt` fields of the node. A renderer's
 * prototype carries their defaults (see `installFieldDefaults`), so a node only
 * gains own properties for what is written to it. Plain objects with no
 * defaults read `undefined` for every field, which means the same.
 *
 * Named, not symbol-keyed, and kept on the node rather than in a record or a
 * `WeakMap`: V8 reads a named property found only on the prototype quickly
 * even across many node shapes, a symbol-keyed one slowly, and every other
 * layout measured was slower or larger.
 */
interface SceneFields {
    /** This node's update method, set by `setTickMethods`. */
    _mvtUpdateMethod?: UpdateMethod;
    /** This node's refresh method, set by `setTickMethods`. */
    _mvtRefreshMethod?: RefreshMethod;
    /** Does this subtree hold any update method? `undefined` = dirty. */
    _mvtSubtreeHasUpdate?: boolean;
    /** Update walk for this subtree. `undefined` = dirty. */
    _mvtUpdateWalk?: SubtreeWalk<object>;
    /** Does this subtree hold any refresh method? `undefined` = dirty. */
    _mvtSubtreeHasRefresh?: boolean;
    /** Refresh walk for this subtree. `undefined` = dirty. */
    _mvtRefreshWalk?: SubtreeWalk<object>;
    /**
     * The id of the refresh scene pass that last ran this node, negated if it
     * returned `SKIP_DESCENDANTS`. Written only while catching up a scene pass
     * whose tree changed during it; see `catchUpRefresh`.
     */
    _mvtLastRefreshPass?: number;
    /**
     * The invalidation climbs of the scene passes that walk this node, so
     * setting a method can invalidate the walks above it. On a renderer's
     * prototype; written on a plain object when a walk first visits it.
     */
    _mvtInvalidators?: Invalidators;
}

/** The invalidation climbs of one kind of tree's scene passes, which a node's fields lead to. */
interface Invalidators {
    readonly invalidateUpdate: (node: object) => void;
    readonly invalidateRefresh: (node: object) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The scene passes over one kind of tree. See the @mvtjs/pixi design notes for
 * how the memoised walk works and what was measured; nothing here is specific
 * to Pixi.
 *
 * Each call makes its own passes, re-entry guard and invalidation climbs, one
 * per kind of node. Nodes of different kinds never share a tree, so they
 * never need to share them.
 */
export function createScenePasses<N extends object>(tree: SceneTree<N>): ScenePasses<N> {
    // Nodes with a scene pass in flight, so a method that re-enters the scene
    // pass it is already inside is caught rather than silently running the
    // list twice. Starting a scene pass on a different node from a method is
    // fine.
    const activeUpdates: N[] = [];
    const activeRefreshes: N[] = [];

    // The id of the refresh scene pass in flight, or of the last one. Nested
    // refresh scene passes share their outermost one's id, which is what
    // makes "exactly once" hold across them.
    let refreshPassId = 0;

    // The walks of nested refresh scene passes run since the outermost one
    // began (or since it last caught up), not yet replayed onto their nodes.
    // Catching up needs them, as well as its own walk, to know what ran.
    const nestedWalks: SubtreeWalk<N>[] = [];

    // Whether `installFieldDefaults` has put the fields' defaults, these passes
    // among them, on the nodes' prototype. Until it has (a tree of plain
    // objects), each node visited is given the passes itself.
    let hasPrototypeDefaults = false;

    // Reached from every node these passes visit, through its fields, so that
    // setting a method on it later can invalidate the walks above it.
    const invalidators: Invalidators = {
        invalidateUpdate: (node) => invalidateUpdate(node as N),
        invalidateRefresh: (node) => invalidateRefresh(node as N),
    };

    return { invalidate, installFieldDefaults, tickScene, setTickMethods };

    /**
     * The update scene pass: runs every update method in `node`'s subtree,
     * each exactly once, calling a node before any of its descendants. Sibling
     * order is unspecified.
     *
     * The walk for `node` is memoised on `node` itself and invalidated by tree
     * mutation, so a static scene pays a list walk and nothing else. A method
     * may return `SKIP_DESCENDANTS` to skip its descendants this frame; the
     * node itself has already run, so it can stop skipping next frame. In the
     * update scene pass that freezes a subtree's state advance, so it is an
     * opt-in for deliberately frozen subtrees, such as a paused game, rather
     * than a routine tool.
     */
    function updateScene(node: N, deltaMs: number): void {
        tree.beforeScenePass?.(node);
        enter(activeUpdates, node, 'update');
        try {
            const fields = visit(node);
            let walk = fields._mvtUpdateWalk as SubtreeWalk<N> | undefined;
            if (walk === undefined) {
                walk = buildSubtreeWalk(node, UPDATE);
                fields._mvtUpdateWalk = walk;
            }
            invokeSubtreeMethods(walk, node, UPDATE, deltaMs, 0);
        }
        finally {
            activeUpdates.pop();
        }
    }

    /**
     * The refresh scene pass: the refresh half of `updateScene`, with the same
     * memo and ordering, and one addition: it covers the subtree as it stands
     * when it returns, not only as it stood when it started. A node attached,
     * or given a refresh method, by a method during the scene pass is
     * refreshed before it returns, so a view may build children in its own
     * refresh method and they are never drawn unrefreshed. Nested refresh
     * scene passes started by methods share the outer scene pass, so a node
     * refreshed by one is not refreshed again by the other.
     *
     * Nothing gates on visibility, so a view is free to set its own
     * visibility; to skip refreshing its descendants (a hidden or absent
     * subtree) it says so explicitly by returning `SKIP_DESCENDANTS`, which
     * covers nodes attached beneath it later in the same scene pass too.
     */
    function refreshScene(node: N): void {
        tree.beforeScenePass?.(node);
        enter(activeRefreshes, node, 'refresh');
        const isOutermost = activeRefreshes.length === 1;
        if (isOutermost) refreshPassId = refreshPassId === MAX_REFRESH_PASS_ID ? 1 : refreshPassId + 1;
        try {
            const fields = visit(node);
            let walk = fields._mvtRefreshWalk as SubtreeWalk<N> | undefined;
            if (walk === undefined) {
                walk = buildSubtreeWalk(node, REFRESH);
                fields._mvtRefreshWalk = walk;
            }
            invokeSubtreeMethods(walk, node, REFRESH, undefined, refreshPassId);

            // Any change to the subtree during the walk cleared its memo. A
            // renderer that hears of changes only when it asks is asked again.
            tree.beforeScenePass?.(node);
            if (fields._mvtRefreshWalk !== walk) catchUpRefresh(node, walk);
            else if (!isOutermost) nestedWalks.push(walk);
        }
        finally {
            activeRefreshes.pop();
            if (isOutermost && nestedWalks.length !== 0) nestedWalks.length = 0;
        }
    }

    function tickScene(options: TickSceneOptions<N>): void {
        if (options.only !== 'refresh') {
            if (DEV) assertFiniteDeltaMs(options.root, options.deltaMs);
            updateScene(options.root, options.deltaMs);
        }
        if (options.only !== 'update') refreshScene(options.root);
    }

    /**
     * Dev-only guard against a `deltaMs` that is not a finite number, which
     * would carry `NaN` or `Infinity` into every view's presentation state,
     * where it shows up frames later and far from its cause. A negative one is
     * allowed: a host may run time backwards, such as a speed control.
     */
    function assertFiniteDeltaMs(root: N, deltaMs: unknown): void {
        if (typeof deltaMs === 'number' && Number.isFinite(deltaMs)) return;
        throw new Error(
            `[mvt] tickScene() on ${tree.describe(root)} was given deltaMs ${String(deltaMs)}. `
            + 'It must be a finite number of milliseconds.',
        );
    }

    /**
     * Refreshes whatever a refresh scene pass's methods added to the subtree
     * while it ran: nodes attached, and nodes given a refresh method, which the
     * walk listed before they existed. Only called when the subtree changed
     * during the walk, so a steady scene never gets here.
     *
     * First it replays the scene pass's own walk, and every nested walk, onto
     * their nodes, marking each node that ran. Then each round rebuilds the
     * list and walks it, running only the nodes not marked for this scene
     * pass and skipping any subtree whose root returned `SKIP_DESCENDANTS` in
     * it. Those methods can change the tree again, so it repeats until a round
     * changes nothing.
     *
     * The rebuilt list is the memo the next frame would have rebuilt anyway,
     * so the extra cost of a frame whose tree changed mid-pass is the replay
     * and one walk that runs only the missed nodes.
     */
    function catchUpRefresh(node: N, firstWalk: SubtreeWalk<N>): void {
        const passId = refreshPassId;
        const fields = visit(node);
        markRefreshedNodes(firstWalk, passId);
        for (let round = 1; ; round++) {
            if (round > MAX_CATCH_UP_ROUNDS) {
                throw new Error(
                    `[mvt] The refresh scene pass on ${tree.describe(node)} was still changing the tree after `
                    + `${MAX_CATCH_UP_ROUNDS} rounds. A method is adding a node, or giving one a refresh method, `
                    + 'on every refresh, and the nodes it adds do the same.',
                );
            }
            // Nested scene passes run by the methods so far
            for (let w = 0; w < nestedWalks.length; w++) markRefreshedNodes(nestedWalks[w], passId);
            nestedWalks.length = 0;

            let walk = fields._mvtRefreshWalk as SubtreeWalk<N> | undefined;
            if (walk === undefined) {
                walk = buildSubtreeWalk(node, REFRESH);
                fields._mvtRefreshWalk = walk;
            }
            invokeMissedMethods(walk, node, passId);

            tree.beforeScenePass?.(node);
            if (fields._mvtRefreshWalk === walk) return;
        }
    }

    /**
     * Replays a refresh walk run in scene pass `passId` from the elisions it
     * recorded, marking each node it ran with `passId`, or `-passId` if it
     * returned `SKIP_DESCENDANTS`. An elision recorded by an earlier scene
     * pass carries a different id, so it reads as an entry that ran and
     * stepped on.
     */
    function markRefreshedNodes(walk: SubtreeWalk<N>, passId: number): void {
        const list = walk.list;
        const skip = walk.skip;
        const elisions = walk.elisions!;
        const detachedElision = encodeElision(passId, ELIDED_DETACHED);
        const methodClearedElision = encodeElision(passId, ELIDED_METHOD_CLEARED);
        const descendantsElision = encodeElision(passId, ELIDED_DESCENDANTS);
        for (let i = 0; i < list.length;) {
            const elision = elisions[i];
            if (elision === detachedElision) {
                i = skip[i];
                continue;
            }
            if (elision === methodClearedElision) {
                i++;
                continue;
            }
            fieldsOf(list[i])._mvtLastRefreshPass = elision === descendantsElision ? -passId : passId;
            i = elision === descendantsElision ? skip[i] : i + 1;
        }
    }

    /**
     * One catch-up round: walks the list, skipping detached subtrees and any
     * subtree whose root returned `SKIP_DESCENDANTS` this scene pass, and runs
     * each node that has not run this scene pass. Methods are read live: this
     * is the rare path, and they may have been assigned since the list was
     * built.
     */
    function invokeMissedMethods(walk: SubtreeWalk<N>, node: N, passId: number): void {
        const list = walk.list;
        const skip = walk.skip;
        for (let i = 0; i < list.length;) {
            const listed = list[i];
            if (listed !== node && !tree.parent(listed)) {
                i = skip[i];
                continue;
            }
            const listedFields = fieldsOf(listed);
            const lastPass = listedFields._mvtLastRefreshPass;
            if (lastPass === -passId) {
                i = skip[i];
                continue;
            }
            if (lastPass !== passId) {
                const method = listedFields._mvtRefreshMethod;
                if (method !== undefined) {
                    if (sceneCounter.isCounting) sceneCounter.methodCalls++;
                    const skipsDescendants = method() === SKIP_DESCENDANTS;
                    listedFields._mvtLastRefreshPass = skipsDescendants ? -passId : passId;
                    if (skipsDescendants) {
                        i = skip[i];
                        continue;
                    }
                }
            }
            i++;
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
            const fields = fieldsOf(cursor);
            if (fields._mvtSubtreeHasUpdate === undefined && fields._mvtUpdateWalk === undefined) return;
            // Both fields of a kind are cleared together: they are maintained in
            // lockstep and the short-circuit above tests both.
            fields._mvtSubtreeHasUpdate = undefined;
            fields._mvtUpdateWalk = undefined;
            cursor = tree.parent(cursor);
        }
    }

    /** The refresh half of {@link invalidateUpdate}. */
    function invalidateRefresh(node: N): void {
        let cursor: N | null | undefined = node;
        while (cursor) {
            const fields = fieldsOf(cursor);
            if (fields._mvtSubtreeHasRefresh === undefined && fields._mvtRefreshWalk === undefined) return;
            fields._mvtSubtreeHasRefresh = undefined;
            fields._mvtRefreshWalk = undefined;
            cursor = tree.parent(cursor);
        }
    }

    /**
     * Puts the fields' defaults on `prototype`, so reading one on a node that
     * never had it written finds it on the prototype, and these passes'
     * invalidation climbs with them.
     */
    function installFieldDefaults(prototype: object): void {
        const defaults: SceneFields = {
            _mvtUpdateMethod: undefined,
            _mvtRefreshMethod: undefined,
            _mvtSubtreeHasUpdate: undefined,
            _mvtUpdateWalk: undefined,
            _mvtSubtreeHasRefresh: undefined,
            _mvtRefreshWalk: undefined,
            _mvtLastRefreshPass: 0,
            _mvtInvalidators: invalidators,
        };
        Object.defineProperties(prototype, Object.getOwnPropertyDescriptors(defaults));
        hasPrototypeDefaults = true;
    }

    /**
     * The node's fields, for a walk that visits it. A node whose prototype
     * carries no defaults (a plain object) is given these passes'
     * invalidation climbs here, which is what lets `setUpdate` /
     * `setRefresh` invalidate its walks later.
     */
    function visit(node: N): SceneFields {
        const fields = fieldsOf(node);
        // A renderer's nodes find the climbs on their prototype. Not read
        // when they do: it would be one more read per node per rebuild.
        if (!hasPrototypeDefaults && fields._mvtInvalidators === undefined) fields._mvtInvalidators = invalidators;
        return fields;
    }

    function enter(active: N[], node: N, pass: 'update' | 'refresh'): void {
        for (let i = 0; i < active.length; i++) {
            if (active[i] !== node) continue;
            throw new Error(
                `[mvt] The ${pass} scene pass was started re-entrantly on the same node, ${tree.describe(node)}. `
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
     * Methods are called from the list's cache rather than read from each
     * node's field: a scene of mixed node shapes makes that read
     * megamorphic, and caching made refresh 30-40% cheaper on such scenes.
     * A method assigned or cleared during the scene pass (a `<List>` building
     * slots, a view silencing a sibling) bumps `methodAssignments`, and from
     * then on this scene pass reads methods live, so a method cleared earlier
     * in the scene pass never runs later in it.
     *
     * A refresh walk also records what it elides at each entry, tagged with
     * `passId`, the scene pass's id, so that `catchUpRefresh` can replay the
     * walk if the tree changed meanwhile. An entry run and stepped past
     * records nothing.
     *
     * The calls are counted for `sceneCounter` by what the walk elides, in
     * the branches that elide, so a method called and stepped past costs the
     * loop nothing extra; the count is added once, after it.
     */
    function invokeSubtreeMethods(walk: SubtreeWalk<N>, node: N, pass: Pass, deltaMs: number | undefined, passId: number): void {
        const list = walk.list;
        const methods = walk.methods;
        const skip = walk.skip;
        const elisions = walk.elisions;
        const assignmentsAtStart = methodAssignments;
        let elided = 0;
        for (let i = 0; i < list.length;) {
            const listed = list[i];
            // Detached by a method earlier in this scene pass: skip its whole
            // subtree, whose internal parent links are still intact. The node
            // the scene pass started from may have no parent, and is exempt.
            if (listed !== node && !tree.parent(listed)) {
                if (elisions !== undefined) elisions[i] = encodeElision(passId, ELIDED_DETACHED);
                elided += skip[i] - i;
                i = skip[i];
                continue;
            }
            const method = methodAssignments === assignmentsAtStart
                ? methods[i]
                : (pass === UPDATE ? fieldsOf(listed)._mvtUpdateMethod : fieldsOf(listed)._mvtRefreshMethod) as SceneMethod | undefined;
            // Only when a method was cleared earlier in this scene pass
            if (method === undefined) {
                if (elisions !== undefined) elisions[i] = encodeElision(passId, ELIDED_METHOD_CLEARED);
                elided++;
                i++;
                continue;
            }
            if (method(deltaMs) === SKIP_DESCENDANTS) {
                if (elisions !== undefined) elisions[i] = encodeElision(passId, ELIDED_DESCENDANTS);
                elided += skip[i] - i - 1;
                i = skip[i];
                continue;
            }
            i++;
        }
        if (sceneCounter.isCounting) sceneCounter.methodCalls += list.length - elided;
    }

    /**
     * Builds the memoised {@link SubtreeWalk} for `node`'s subtree: the
     * preorder list of nodes carrying the scene pass's method, their methods,
     * and the skip table over them.
     */
    function buildSubtreeWalk(node: N, pass: Pass): SubtreeWalk<N> {
        // The root's visit; `has` counts the rest
        if (sceneCounter.isCounting) {
            sceneCounter.walkRebuilds++;
            sceneCounter.rebuildVisits++;
        }
        const list: N[] = [];
        const methods: SceneMethod[] = [];
        const ends: number[] = [];
        collectSubtreeMethods(node, pass, list, methods, ends);
        const elisions = pass === REFRESH ? new Int32Array(list.length) : undefined;
        return { list, methods, skip: Int32Array.from(ends), elisions };
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
        const fields = visit(node);
        // An update method only ever runs in the update scene pass, which
        // always passes a number (see `SceneMethod`).
        const method = (pass === UPDATE ? fields._mvtUpdateMethod : fields._mvtRefreshMethod) as SceneMethod | undefined;
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
        if (sceneCounter.isCounting) sceneCounter.rebuildVisits++;
        const fields = visit(node);
        const cached = pass === UPDATE ? fields._mvtSubtreeHasUpdate : fields._mvtSubtreeHasRefresh;
        if (cached !== undefined) return cached;
        let found = (pass === UPDATE ? fields._mvtUpdateMethod : fields._mvtRefreshMethod) !== undefined;
        const children = tree.children(node);
        for (let i = 0; i < children.length; i++) {
            if (has(children[i], pass)) found = true;
        }
        if (pass === UPDATE) fields._mvtSubtreeHasUpdate = found;
        else fields._mvtSubtreeHasRefresh = found;
        return found;
    }
}

/**
 * Sets what `node` does on each tick, in one call: its update method, which
 * advances its cosmetic presentation state, its refresh method, which writes
 * model state to its presentation output, or both.
 *
 * It registers steps for `tickScene` to call, and does not subscribe to a
 * clock: nothing runs until a caller ticks the node or an ancestor, with the
 * `deltaMs` that caller chooses. Each call replaces the methods it is given,
 * rather than adding to them.
 *
 * ```ts
 * setTickMethods(view, {
 *     update: (deltaMs) => { flash.update(deltaMs); },
 *     refresh: () => { view.alpha = flash.alpha; },
 * });
 * ```
 *
 * A member left out is left as it is, so the two can be set apart; one given
 * as `undefined` is cleared. Works on a node of any renderer, attached or
 * not, and on any plain object a renderer's scene passes walk. Setting a
 * method on a node already walked invalidates the walks above it, so the next
 * scene pass includes it.
 *
 * A member that declares a parameter for the method it replaces wraps it: a
 * refresh method with one or more parameters, an update method with two or
 * more. It is given the method it replaces, or `undefined` if there was none,
 * once, when it is set, and may call it (at most once per call), which is how
 * a component gates or extends a child view's own step. Any other method
 * replaces the one before, which is released.
 *
 * ```ts
 * setTickMethods(slot, {
 *     refresh: (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS),
 * });
 * setTickMethods(node, { update: (deltaMs, own) => own?.(deltaMs) });
 * ```
 *
 * The parameters are counted by the method's declared `length`, so a
 * parameter with a default value, or a rest parameter, does not count: such a
 * method replaces. Wrap after the node's own method is set; setting a method
 * afterwards, or clearing it, replaces the whole chain.
 */
export function setTickMethods(node: object, methods: TickMethods): void {
    if ('update' in methods) setUpdate(node, methods.update);
    if ('refresh' in methods) setRefresh(node, methods.refresh);
}

/** Whether `node` has an update method. Never hands out the method itself. */
export function hasUpdate(node: object): boolean {
    return fieldsOf(node)._mvtUpdateMethod !== undefined;
}

/** Whether `node` has a refresh method. Never hands out the method itself. */
export function hasRefresh(node: object): boolean {
    return fieldsOf(node)._mvtRefreshMethod !== undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * An update or refresh method, as the loop calls it: with `deltaMs` in the
 * update scene pass, and `undefined` in the refresh scene pass. One call site
 * for both. `undefined`, not a placeholder number, so a refresh method that
 * declares a parameter without wrapping (one with a default value, which
 * `setRefresh` does not count) sees that default.
 */
type SceneMethod = (deltaMs: number | undefined) => typeof SKIP_DESCENDANTS | void;

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
 * The largest refresh scene pass id before the ids wrap back to 1: the largest
 * whose encoded elisions still fit an `Int32Array`. An elision could only be
 * misread 2^29 scene passes later, over three months of frames at 60 fps.
 */
const MAX_REFRESH_PASS_ID = 0x1fffffff;

// What a refresh walk elided at an entry, and why.
/** The entry and its descendants: the entry was detached. */
const ELIDED_DETACHED = 1;
/** The entry: its method was cleared earlier in the scene pass. */
const ELIDED_METHOD_CLEARED = 2;
/** The entry's descendants: the entry ran and returned `SKIP_DESCENDANTS`. */
const ELIDED_DESCENDANTS = 3;
type ElisionKind = typeof ELIDED_DETACHED | typeof ELIDED_METHOD_CLEARED | typeof ELIDED_DESCENDANTS;

/**
 * An elision's record in `SubtreeWalk.elisions`: its kind, tagged with the
 * scene pass's id, so a record left by an earlier scene pass never matches.
 * Zero, a fresh array's value, matches no scene pass, since ids start at 1.
 */
function encodeElision(passId: number, kind: ElisionKind): number {
    return passId * 4 + kind;
}

/**
 * How many rounds catching up a refresh scene pass may take. Each round runs
 * only the nodes the previous one added, so a real scene needs one or two;
 * more means methods are adding nodes that add nodes, without end.
 */
const MAX_CATCH_UP_ROUNDS = 100;

/**
 * How many times any node's update or refresh method has been set, by any
 * tree. A scene pass records it on entry and, if it has changed, reads
 * methods live for the rest of that scene pass. Shared by every tree, so a
 * method that assigns a method on another kind of node is safe too.
 */
let methodAssignments = 0;

/**
 * Sets `node`'s update method, or clears it with `undefined`:
 * `setTickMethods`'s `update` member, with its rules.
 */
function setUpdate(node: object, method: UpdateMethodOrWrapper | undefined): void {
    const fields = fieldsOf(node);
    const previous = fields._mvtUpdateMethod;
    const stored = method !== undefined && method.length > 1 && previous !== undefined
        ? bindPreviousUpdate(method, previous)
        : method as UpdateMethod | undefined;
    if (fields._mvtUpdateMethod === stored) return;
    fields._mvtUpdateMethod = stored;
    methodAssignments++;
    fields._mvtInvalidators?.invalidateUpdate(node);
}

/**
 * Sets `node`'s refresh method, or clears it with `undefined`:
 * `setTickMethods`'s `refresh` member, with its rules.
 */
function setRefresh(node: object, method: RefreshMethodOrWrapper | undefined): void {
    const fields = fieldsOf(node);
    const previous = fields._mvtRefreshMethod;
    const stored = method !== undefined && method.length > 0 && previous !== undefined
        ? bindPreviousRefresh(method, previous)
        : method as RefreshMethod | undefined;
    if (fields._mvtRefreshMethod === stored) return;
    fields._mvtRefreshMethod = stored;
    methodAssignments++;
    fields._mvtInvalidators?.invalidateRefresh(node);
}

/**
 * A wrapping update method, bound to the one it replaces. Bound once, when it
 * is set, so the scene passes call every method the same way and pay nothing
 * for methods that do not wrap. A wrapper with nothing to wrap is stored as it
 * is: the scene passes give it no second argument, which is `undefined`.
 */
function bindPreviousUpdate(method: UpdateMethodOrWrapper, previous: UpdateMethod): UpdateMethod {
    return (deltaMs) => method(deltaMs, previous);
}

/**
 * A wrapping refresh method, bound to the one it replaces, as
 * `bindPreviousUpdate`. A wrapper with nothing to wrap is stored as it is:
 * the refresh scene pass calls it with `undefined` (see `SceneMethod`).
 */
function bindPreviousRefresh(method: RefreshMethodOrWrapper, previous: RefreshMethod): RefreshMethod {
    return () => method(previous);
}

function fieldsOf(node: object): SceneFields {
    return node as SceneFields;
}
