import { assert } from '../assert';
import { PROTOCOL } from '../copies';
import type { View } from './renderer-views';
import { utilsState } from './shared-state';
import { SKIP_DESCENDANTS } from './skip-descendants';
import { tickCounter } from './tick-counter';
import type { RefreshMethod, UpdateMethod } from './tick-methods';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Calls every update method in `view`, each exactly once, a view's before any
 * of its descendants'; sibling order is unspecified. The first half of a
 * tick: a host calls it once per frame on its whole stage, after advancing its
 * models, and then calls {@link refreshView}.
 *
 * ```ts
 * cabinet.update(deltaMs);
 * updateView(app.stage, deltaMs);
 * refreshView(app.stage);
 * ```
 *
 * `view` can be any view, at any time: a whole stage, a single view under
 * test, or one branch of a stage that is also updated. Nothing here touches a
 * renderer or a ticker, which is what lets a view be stepped in a test,
 * fast-forwarded (many updates, then one refresh), or stepped to produce a
 * thumbnail.
 *
 * A method may return `SKIP_DESCENDANTS` to skip its descendants for that
 * call; the view itself has already run, so it can stop skipping next time.
 * That freezes a subtree's presentation state, so it is an opt-in for
 * deliberately frozen subtrees, such as a paused game, rather than a routine
 * tool. Nothing gates on visibility.
 *
 * In dev builds, a `deltaMs` that is not a finite number throws, and so does
 * a value that is not a view of any installed renderer. A negative `deltaMs`
 * is allowed: a host may run time backwards, such as a speed control.
 */
export function updateView(view: View, deltaMs: number): void {
    updateNode(view, deltaMs);
}

/**
 * Calls every refresh method in `view`, each exactly once, a view's before
 * any of its descendants'; sibling order is unspecified. The second half of a
 * tick, after {@link updateView}, before the renderer draws.
 *
 * It covers the view as it stands when it returns, not only as it stood when
 * it started: a node attached, or given a refresh method, by a method during
 * the call is refreshed before it returns, so a view may build children in its
 * own refresh method and they are never drawn unrefreshed. A `refreshView`
 * called from inside a refresh method shares the outer call, so a node
 * refreshed by one is not refreshed again by the other.
 *
 * Nothing gates on visibility, so a view is free to set its own visibility;
 * to skip refreshing its descendants (a hidden or absent subtree) it says so
 * explicitly by returning `SKIP_DESCENDANTS`, which covers nodes attached
 * beneath it later in the same call too.
 */
export function refreshView(view: View): void {
    refreshNode(view);
}

/**
 * Sets `view`'s update method, which advances its cosmetic presentation
 * state, or clears it with `undefined`.
 *
 * It registers a step for {@link updateView} to call, and does not subscribe
 * to a clock: nothing runs until a caller updates the view or an ancestor,
 * with the `deltaMs` that caller chooses. A call replaces the method before,
 * which is released, rather than adding to it.
 *
 * ```ts
 * setUpdate(view, (deltaMs) => { flash.update(deltaMs); });
 * ```
 *
 * A method that declares a second parameter wraps the method it replaces: it
 * is given that method, or `undefined` if there was none, and may call it (at
 * most once per call), which is how a component gates or extends a child
 * view's own step.
 *
 * ```ts
 * setUpdate(node, (deltaMs, own) => own?.(deltaMs));
 * ```
 *
 * Parameters are counted by the method's declared `length`, so a parameter
 * with a default value, or a rest parameter, does not count: such a method
 * replaces. Wrap after the view's own method is set; setting a method
 * afterwards, or clearing it, replaces the whole chain.
 *
 * Works on a view attached or not. Setting a method on a view already listed
 * clears the method lists above it, so the next `updateView` includes it.
 */
export function setUpdate(view: View, method: UpdateMethodOrWrapper | undefined): void {
    setNodeUpdate(view, method);
}

/**
 * Sets `view`'s refresh method, which writes model state to its presentation
 * output, or clears it with `undefined`. The refresh counterpart of
 * {@link setUpdate}, with the same rules, except that a refresh method wraps
 * the one it replaces when it declares one parameter.
 *
 * ```ts
 * setRefresh(view, () => { view.alpha = flash.alpha; });
 * setRefresh(slot, (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS));
 * ```
 */
export function setRefresh(view: View, method: RefreshMethodOrWrapper | undefined): void {
    setNodeRefresh(view, method);
}

/** Whether `view` has an update method. Never hands out the method itself. */
export function hasUpdate(view: View): boolean {
    return hasNodeUpdate(view);
}

/** Whether `view` has a refresh method. Never hands out the method itself. */
export function hasRefresh(view: View): boolean {
    return hasNodeRefresh(view);
}

/**
 * Registers a renderer's nodes, so that `updateView` and `refreshView` can
 * walk them: how to read a node's children and parent, and the prototype every
 * node of the renderer inherits from, such as Pixi's `Container.prototype`.
 *
 * It puts the private fields' defaults on that prototype, so a node only gains
 * own properties for what is written to it, and every node leads back to this
 * registration. A renderer's code calls it once, at module load, keeps the
 * `invalidate` it returns, and calls that from every operation that adds or
 * removes a child. It declares its view type in `RendererViews` in the same
 * module.
 *
 * Registering a prototype twice throws. Copies of a renderer package share
 * one registration through `shareAcrossCopies`.
 */
export function registerRenderer<N extends object>(options: RegisterRendererOptions<N>): RegisteredRenderer<N> {
    const { prototype } = options;
    assert(
        !Object.hasOwn(prototype, '_mvtRenderer'),
        () => `[mvt] ${describeValue(prototype)} is already registered as a renderer's prototype.`,
    );
    const renderer = createRenderer(options);
    const defaults: NodeFields = {
        _mvtUpdateMethod: undefined,
        _mvtRefreshMethod: undefined,
        _mvtSubtreeHasUpdate: undefined,
        _mvtUpdateMethodList: undefined,
        _mvtSubtreeHasRefresh: undefined,
        _mvtRefreshMethodList: undefined,
        _mvtLastRefreshId: 0,
        _mvtRenderer: renderer,
        _mvtProtocol: undefined,
    };
    Object.defineProperties(prototype, Object.getOwnPropertyDescriptors(defaults));
    return { invalidate: (node) => renderer.invalidate(node) };
}

/** How `updateView` and `refreshView` walk one renderer's tree, as `registerRenderer` takes it. */
export interface RegisterRendererOptions<N extends object> {
    /** The prototype every node of the renderer inherits from, such as Pixi's `Container.prototype`. */
    readonly prototype: N;
    /** The node's children, in order. Read only when a method list is rebuilt. */
    readonly children: (node: N) => ArrayLike<N>;
    /**
     * The node's parent, if it has one. Read once per entry per call, to skip
     * nodes detached during it, and when clearing method lists.
     */
    readonly parent: (node: N) => N | null | undefined;
    /** Names a node in error and warning messages. */
    readonly describe: (node: N) => string;
    /**
     * Called at the start of every `updateView` and `refreshView`, with the
     * node it starts from, before its method list is read, and again when a
     * refresh ends. For a renderer that learns of changes to its tree only
     * when it asks (the DOM, through a `MutationObserver`), this is where it
     * asks, and calls `invalidate` for what changed. Renderers that report
     * changes as they happen leave it out.
     */
    readonly flushChanges?: (node: N) => void;
}

/** What a renderer's own code needs back from `registerRenderer`. */
export interface RegisteredRenderer<N extends object> {
    /**
     * Records that `node`'s children changed: clears both method lists from
     * `node` up to the root. A renderer's code calls it from every operation
     * that adds or removes a child, however the tree does that.
     */
    readonly invalidate: (node: N) => void;
}

/**
 * An update method as `setUpdate` takes it: one that declares a second
 * parameter is given the update method it replaces.
 */
type UpdateMethodOrWrapper = (deltaMs: number, previous: UpdateMethod | undefined) => typeof SKIP_DESCENDANTS | void;

/**
 * A refresh method as `setRefresh` takes it: one that declares a parameter is
 * given the refresh method it replaces.
 */
type RefreshMethodOrWrapper = (previous: RefreshMethod | undefined) => typeof SKIP_DESCENDANTS | void;

// ---------------------------------------------------------------------------
// Within @mvtjs/utils
// ---------------------------------------------------------------------------

// The functions above, untyped, each named as its public function with "node"
// in it: for this package's own code, such as the JSX base, which works on any
// renderer's nodes (`N extends object`) and so cannot name them as a `View`.
// Not exported from the package.

/** {@link updateView} on any registered renderer's node. */
export function updateNode(node: object, deltaMs: number): void {
    rendererOf(node, 'updateView').update(node, deltaMs);
}

/** {@link refreshView} on any registered renderer's node. */
export function refreshNode(node: object): void {
    rendererOf(node, 'refreshView').refresh(node);
}

/** {@link setUpdate} on any node. */
export function setNodeUpdate(node: object, method: UpdateMethodOrWrapper | undefined): void {
    const fields = fieldsOf(node);
    const previous = fields._mvtUpdateMethod;
    const stored = method !== undefined && method.length > 1 && previous !== undefined
        ? bindPreviousUpdate(method, previous)
        : method as UpdateMethod | undefined;
    if (fields._mvtUpdateMethod === stored) return;
    fields._mvtUpdateMethod = stored;
    utilsState.methodAssignments++;
    if (DEV) fields._mvtProtocol = PROTOCOL;
    fields._mvtRenderer?.invalidateUpdate(node);
}

/** {@link setRefresh} on any node. */
export function setNodeRefresh(node: object, method: RefreshMethodOrWrapper | undefined): void {
    const fields = fieldsOf(node);
    const previous = fields._mvtRefreshMethod;
    const stored = method !== undefined && method.length > 0 && previous !== undefined
        ? bindPreviousRefresh(method, previous)
        : method as RefreshMethod | undefined;
    if (fields._mvtRefreshMethod === stored) return;
    fields._mvtRefreshMethod = stored;
    utilsState.methodAssignments++;
    if (DEV) fields._mvtProtocol = PROTOCOL;
    fields._mvtRenderer?.invalidateRefresh(node);
}

/** {@link hasUpdate} on any node. */
export function hasNodeUpdate(node: object): boolean {
    return fieldsOf(node)._mvtUpdateMethod !== undefined;
}

/** {@link hasRefresh} on any node. */
export function hasNodeRefresh(node: object): boolean {
    return fieldsOf(node)._mvtRefreshMethod !== undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A registered renderer, as each of its nodes leads to it through
 * `_mvtRenderer` on its prototype: its `updateView` and `refreshView`, and the
 * walks up the tree that clear its method lists.
 */
interface Renderer {
    readonly update: (node: object, deltaMs: number) => void;
    readonly refresh: (node: object) => void;
    readonly invalidate: (node: object) => void;
    readonly invalidateUpdate: (node: object) => void;
    readonly invalidateRefresh: (node: object) => void;
}

/**
 * The cached update or refresh method list for a node's subtree: a preorder
 * list of the nodes that have a method of that kind, their methods, and a
 * skip table, so a returned `SKIP_DESCENDANTS` skips a subtree in one step.
 * `skip[i]` is the index just past entry `i`'s subtree, which is contiguous
 * because the list is preorder.
 *
 * The three travel together on purpose. A skip table or a method cache that
 * outlived the list it indexes would be a second source of truth about the
 * tree; bundled, they are derived from the list and cleared with it.
 */
interface MethodList<N> {
    readonly nodes: N[];
    /**
     * Each listed node's method, read when the list was built, so the loop
     * calls it without reading the node's field, a read that a scene of
     * mixed node shapes makes megamorphic.
     * Assigning any method during an invocation sends the rest of that
     * invocation back to reading them live; see `invokeMethodList`.
     */
    readonly methods: ListedMethod[];
    readonly skip: Int32Array;
    /**
     * Refresh method lists only: what the last invocation elided at each entry
     * (the entry, its descendants, or both) and why, tagged with its refresh's
     * id (see `encodeElision`). An entry with no elision for that refresh ran,
     * and the invocation stepped to the next. Invoking is otherwise
     * deterministic, so the elisions are enough to replay which entries ran,
     * which `catchUpRefresh` does only if the tree changed during that
     * refresh. Recording only elisions keeps the common path of the loop free
     * of any store.
     */
    readonly elisions: Int32Array | undefined;
}

/**
 * Everything kept for one node: its two methods, and what they cache about
 * its subtree, as private `_mvt` fields of the node. A renderer's prototype
 * carries their defaults (see `registerRenderer`), so a node only gains own
 * properties for what is written to it.
 *
 * Named, not symbol-keyed, and kept on the node rather than in a record or a
 * `WeakMap`: V8 reads a named property found only on the prototype quickly
 * even across many node shapes, a symbol-keyed one slowly, and every other
 * layout measured was slower or larger.
 */
interface NodeFields {
    /** This node's update method, set by `setUpdate`. */
    _mvtUpdateMethod?: UpdateMethod;
    /** This node's refresh method, set by `setRefresh`. */
    _mvtRefreshMethod?: RefreshMethod;
    /** Does this subtree hold any update method? `undefined` = not yet known, or cleared. */
    _mvtSubtreeHasUpdate?: boolean;
    /** The update method list for this subtree. `undefined` = not yet built, or cleared. */
    _mvtUpdateMethodList?: MethodList<object>;
    /** Does this subtree hold any refresh method? `undefined` = not yet known, or cleared. */
    _mvtSubtreeHasRefresh?: boolean;
    /** The refresh method list for this subtree. `undefined` = not yet built, or cleared. */
    _mvtRefreshMethodList?: MethodList<object>;
    /**
     * The id of the refresh that last ran this node, negated if it returned
     * `SKIP_DESCENDANTS`. Written only while catching up a refresh whose tree
     * changed during it; see `catchUpRefresh`.
     */
    _mvtLastRefreshId?: number;
    /**
     * The renderer that registered this node's prototype, so that
     * `updateView` and `refreshView` find how to walk the node's tree, and
     * setting a method can clear the method lists above the node. On the
     * prototype only.
     */
    _mvtRenderer?: Renderer;
    /**
     * Dev builds only: the protocol (`PROTOCOL` in `copies.ts`) of the copy
     * that set this node's methods, so that a copy with another protocol,
     * which cannot see them, can say so. The one field whose name never
     * changes with the protocol.
     */
    _mvtProtocol?: number;
}

/**
 * Makes one renderer's `updateView`, `refreshView` and invalidation. See the
 * @mvtjs/pixi design notes for how the method lists work and what was
 * measured; nothing here is specific to Pixi.
 *
 * Each renderer gets its own re-entry guards and walks up the tree. Nodes of
 * different renderers never share a tree, so they never need to share them.
 */
function createRenderer<N extends object>(options: RegisterRendererOptions<N>): Renderer {
    const { children, parent, describe, flushChanges } = options;

    // Nodes with an `updateView` or `refreshView` in flight, so a method that
    // re-enters the call it is already inside is caught rather than silently
    // invoking the list twice. Starting one on a different node from a method
    // is fine.
    const activeUpdates: N[] = [];
    const activeRefreshes: N[] = [];

    // The id of the refresh in flight, or of the last one. Nested refreshes
    // share their outermost one's id, which is what makes "exactly once" hold
    // across them.
    let refreshId = 0;

    // The method lists of nested refreshes invoked since the outermost one
    // began (or since it last caught up), not yet replayed onto their nodes.
    // Catching up needs them, as well as its own list, to know what ran.
    const nestedInvocations: MethodList<N>[] = [];

    return {
        update: (node, deltaMs) => updateSubtree(node as N, deltaMs),
        refresh: (node) => refreshSubtree(node as N),
        invalidate: (node) => invalidate(node as N),
        invalidateUpdate: (node) => invalidateUpdate(node as N),
        invalidateRefresh: (node) => invalidateRefresh(node as N),
    };

    /**
     * `updateView` on this renderer: invokes the update method list for
     * `node`'s subtree, cached on `node` itself and cleared when the tree
     * changes, so a steady scene pays for invoking the list and nothing else.
     */
    function updateSubtree(node: N, deltaMs: number): void {
        if (DEV) assertFiniteDeltaMs(node, deltaMs);
        flushChanges?.(node);
        enter(activeUpdates, node, 'updateView');
        try {
            const fields = visit(node);
            let list = fields._mvtUpdateMethodList as MethodList<N> | undefined;
            if (list === undefined) {
                list = buildMethodList(node, UPDATE);
                fields._mvtUpdateMethodList = list;
            }
            invokeMethodList(list, node, UPDATE, deltaMs, 0);
        }
        finally {
            activeUpdates.pop();
        }
    }

    /**
     * `refreshView` on this renderer: the refresh half of `updateSubtree`, with
     * the same cache and ordering, and one addition: it catches up whatever
     * its methods attach, or give a refresh method, before it returns.
     */
    function refreshSubtree(node: N): void {
        flushChanges?.(node);
        enter(activeRefreshes, node, 'refreshView');
        const isOutermost = activeRefreshes.length === 1;
        if (isOutermost) refreshId = refreshId === MAX_REFRESH_ID ? 1 : refreshId + 1;
        try {
            const fields = visit(node);
            let list = fields._mvtRefreshMethodList as MethodList<N> | undefined;
            if (list === undefined) {
                list = buildMethodList(node, REFRESH);
                fields._mvtRefreshMethodList = list;
            }
            invokeMethodList(list, node, REFRESH, undefined, refreshId);

            // Any change to the subtree during the invocation cleared its
            // list. A renderer that hears of changes only when it asks is
            // asked again.
            flushChanges?.(node);
            if (fields._mvtRefreshMethodList !== list) catchUpRefresh(node, list);
            else if (!isOutermost) nestedInvocations.push(list);
        }
        finally {
            activeRefreshes.pop();
            if (isOutermost && nestedInvocations.length !== 0) nestedInvocations.length = 0;
        }
    }

    /**
     * Dev-only guard against a `deltaMs` that is not a finite number, which
     * would carry `NaN` or `Infinity` into every view's presentation state,
     * where it shows up frames later and far from its cause.
     */
    function assertFiniteDeltaMs(node: N, deltaMs: unknown): void {
        if (typeof deltaMs === 'number' && Number.isFinite(deltaMs)) return;
        throw new Error(
            `[mvt] updateView() on ${describe(node)} was given deltaMs ${String(deltaMs)}. `
            + 'It must be a finite number of milliseconds.',
        );
    }

    /**
     * Refreshes whatever a refresh's methods added to the subtree while it
     * ran: nodes attached, and nodes given a refresh method, which the list
     * did not hold. Only called when the subtree changed during the
     * invocation, so a steady scene never gets here.
     *
     * First it replays the refresh's own invocation, and every nested one,
     * onto their nodes, marking each node that ran. Then each round rebuilds
     * the list and invokes it, running only the nodes not marked for this
     * refresh and skipping any subtree whose root returned `SKIP_DESCENDANTS`
     * in it. Those methods can change the tree again, so it repeats until a
     * round changes nothing.
     *
     * The rebuilt list is the one the next frame would have rebuilt anyway,
     * so the extra cost of a frame whose tree changed mid-refresh is the
     * replay and one invocation that runs only the missed nodes.
     */
    function catchUpRefresh(node: N, outerList: MethodList<N>): void {
        const id = refreshId;
        const fields = visit(node);
        markRefreshedNodes(outerList, id);
        for (let round = 1; ; round++) {
            if (round > MAX_CATCH_UP_ROUNDS) {
                throw new Error(
                    `[mvt] refreshView() on ${describe(node)} was still changing the tree after `
                    + `${MAX_CATCH_UP_ROUNDS} rounds. A method is adding a node, or giving one a refresh method, `
                    + 'on every refresh, and the nodes it adds do the same.',
                );
            }
            // Nested refreshes run by the methods so far
            for (let n = 0; n < nestedInvocations.length; n++) markRefreshedNodes(nestedInvocations[n], id);
            nestedInvocations.length = 0;

            let list = fields._mvtRefreshMethodList as MethodList<N> | undefined;
            if (list === undefined) {
                list = buildMethodList(node, REFRESH);
                fields._mvtRefreshMethodList = list;
            }
            invokeMissedMethods(list, node, id);

            flushChanges?.(node);
            if (fields._mvtRefreshMethodList === list) return;
        }
    }

    /**
     * Replays an invocation of a refresh method list made in refresh `id`
     * from the elisions it recorded, marking each node it ran with `id`, or
     * `-id` if it returned `SKIP_DESCENDANTS`. An elision recorded by an
     * earlier refresh carries a different id, so it reads as an entry that ran
     * and stepped on.
     */
    function markRefreshedNodes(list: MethodList<N>, id: number): void {
        const nodes = list.nodes;
        const skip = list.skip;
        const elisions = list.elisions!;
        const detachedElision = encodeElision(id, ELIDED_DETACHED);
        const methodClearedElision = encodeElision(id, ELIDED_METHOD_CLEARED);
        const descendantsElision = encodeElision(id, ELIDED_DESCENDANTS);
        for (let i = 0; i < nodes.length;) {
            const elision = elisions[i];
            if (elision === detachedElision) {
                i = skip[i];
                continue;
            }
            if (elision === methodClearedElision) {
                i++;
                continue;
            }
            fieldsOf(nodes[i])._mvtLastRefreshId = elision === descendantsElision ? -id : id;
            i = elision === descendantsElision ? skip[i] : i + 1;
        }
    }

    /**
     * One catch-up round: goes through the list, skipping detached subtrees and
     * any subtree whose root returned `SKIP_DESCENDANTS` in this refresh, and
     * runs each node that has not run in it. Methods are read live: this is
     * the rare path, and they may have been assigned since the list was built.
     */
    function invokeMissedMethods(list: MethodList<N>, node: N, id: number): void {
        const nodes = list.nodes;
        const skip = list.skip;
        for (let i = 0; i < nodes.length;) {
            const listed = nodes[i];
            if (listed !== node && !parent(listed)) {
                i = skip[i];
                continue;
            }
            const listedFields = fieldsOf(listed);
            const lastId = listedFields._mvtLastRefreshId;
            if (lastId === -id) {
                i = skip[i];
                continue;
            }
            if (lastId !== id) {
                const method = listedFields._mvtRefreshMethod;
                if (method !== undefined) {
                    if (tickCounter.isCounting) tickCounter.methodCalls++;
                    const skipsDescendants = method() === SKIP_DESCENDANTS;
                    listedFields._mvtLastRefreshId = skipsDescendants ? -id : id;
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
     * Walks up to the root clearing the update method lists, stopping at the
     * first node already cleared for that kind.
     *
     * The early stop relies on a per-kind invariant - a node cleared for kind
     * K implies all its ancestors are cleared for K - which this walk
     * maintains inductively. After the first change of a frame the chain above
     * it is already cleared, so every later change stops on its first
     * comparison, and a tree that is never updated or refreshed stays cleared
     * and costs one comparison per change.
     */
    function invalidateUpdate(node: N): void {
        let cursor: N | null | undefined = node;
        while (cursor) {
            const fields = fieldsOf(cursor);
            if (fields._mvtSubtreeHasUpdate === undefined && fields._mvtUpdateMethodList === undefined) return;
            // Both fields of a kind are cleared together: they are maintained in
            // lockstep and the early stop above tests both.
            fields._mvtSubtreeHasUpdate = undefined;
            fields._mvtUpdateMethodList = undefined;
            cursor = parent(cursor);
        }
    }

    /** The refresh half of {@link invalidateUpdate}. */
    function invalidateRefresh(node: N): void {
        let cursor: N | null | undefined = node;
        while (cursor) {
            const fields = fieldsOf(cursor);
            if (fields._mvtSubtreeHasRefresh === undefined && fields._mvtRefreshMethodList === undefined) return;
            fields._mvtSubtreeHasRefresh = undefined;
            fields._mvtRefreshMethodList = undefined;
            cursor = parent(cursor);
        }
    }

    /** A node visit: the node's fields, after the dev-only check for a foreign copy. */
    function visit(node: N): NodeFields {
        const fields = fieldsOf(node);
        if (DEV && fields._mvtProtocol !== undefined && fields._mvtProtocol !== PROTOCOL) warnOfForeignNode(node, fields._mvtProtocol);
        return fields;
    }

    /**
     * Dev builds only: warns, once per program, of a node whose methods were
     * set by a copy of @mvtjs with another protocol. Its fields have other
     * names, so this copy never runs its methods.
     */
    function warnOfForeignNode(node: N, protocol: number): void {
        if (hasWarnedOfForeignNode) return;
        hasWarnedOfForeignNode = true;
        console.warn(
            `[mvt] ${describe(node)} was set up by an incompatible copy of @mvtjs (protocol ${protocol}; `
            + `this copy's is ${PROTOCOL}), so its update and refresh methods will not run here. `
            + 'Keep one copy of the @mvtjs packages in the program.',
        );
    }

    function enter(active: N[], node: N, name: 'updateView' | 'refreshView'): void {
        for (let i = 0; i < active.length; i++) {
            if (active[i] !== node) continue;
            throw new Error(
                `[mvt] ${name}() was called on ${describe(node)} from inside a method it called. `
                + `A method cannot start the ${name}() it is already inside; call it on a different subtree.`,
            );
        }
        active.push(node);
    }

    /**
     * Invokes a method list, calling each node's method before its
     * descendants'. A method returning `SKIP_DESCENDANTS` skips its subtree in
     * one step via the skip table, having already run itself, so it can stop
     * skipping on a later frame.
     *
     * Methods are called from the list's cache rather than read from each
     * node's field: a scene of mixed node shapes makes that read
     * megamorphic, and caching made refresh 30-40% cheaper on such scenes.
     * A method assigned or cleared during the invocation (a `<List>` building
     * slots, a view silencing a sibling) bumps `methodAssignments`, and from
     * then on this invocation reads methods live, so a method cleared earlier
     * in it never runs later in it.
     *
     * Invoking a refresh method list also records what it elides at each
     * entry, tagged with `id`, the refresh's id, so that `catchUpRefresh` can
     * replay the invocation if the tree changed meanwhile. An entry run and
     * stepped past records nothing.
     *
     * The calls are counted for `tickCounter` by what the invocation elides,
     * in the branches that elide, so a method called and stepped past costs
     * the loop nothing extra; the count is added once, after it.
     */
    function invokeMethodList(list: MethodList<N>, node: N, kind: MethodKind, deltaMs: number | undefined, id: number): void {
        const nodes = list.nodes;
        const methods = list.methods;
        const skip = list.skip;
        const elisions = list.elisions;
        const state = utilsState;
        const assignmentsAtStart = state.methodAssignments;
        let elided = 0;
        for (let i = 0; i < nodes.length;) {
            const listed = nodes[i];
            // Detached by a method earlier in this invocation: skip its whole
            // subtree, whose internal parent links are still intact. The node
            // the call started from may have no parent, and is exempt.
            if (listed !== node && !parent(listed)) {
                if (elisions !== undefined) elisions[i] = encodeElision(id, ELIDED_DETACHED);
                elided += skip[i] - i;
                i = skip[i];
                continue;
            }
            const method = state.methodAssignments === assignmentsAtStart
                ? methods[i]
                : (kind === UPDATE ? fieldsOf(listed)._mvtUpdateMethod : fieldsOf(listed)._mvtRefreshMethod) as ListedMethod | undefined;
            // Only when a method was cleared earlier in this invocation
            if (method === undefined) {
                if (elisions !== undefined) elisions[i] = encodeElision(id, ELIDED_METHOD_CLEARED);
                elided++;
                i++;
                continue;
            }
            if (method(deltaMs) === SKIP_DESCENDANTS) {
                if (elisions !== undefined) elisions[i] = encodeElision(id, ELIDED_DESCENDANTS);
                elided += skip[i] - i - 1;
                i = skip[i];
                continue;
            }
            i++;
        }
        if (tickCounter.isCounting) tickCounter.methodCalls += nodes.length - elided;
    }

    /**
     * Builds the {@link MethodList} of this kind for `node`'s subtree: the
     * preorder list of nodes with a method of the kind, their methods, and the
     * skip table over them.
     */
    function buildMethodList(node: N, kind: MethodKind): MethodList<N> {
        // The root's node visit; `has` counts the rest
        if (tickCounter.isCounting) {
            tickCounter.methodListRebuilds++;
            tickCounter.rebuildNodeVisits++;
        }
        const nodes: N[] = [];
        const methods: ListedMethod[] = [];
        const ends: number[] = [];
        collectSubtreeMethods(node, kind, nodes, methods, ends);
        const elisions = kind === REFRESH ? new Int32Array(nodes.length) : undefined;
        return { nodes, methods, skip: Int32Array.from(ends), elisions };
    }

    /**
     * Appends `node`'s subtree in preorder, skipping subtrees that hold no
     * method of this kind, and fills the skip table.
     *
     * `ends` grows in lockstep with `nodes` and records, for each listed node,
     * the list length once its whole subtree is collected - the index just
     * past its subtree, since preorder makes a subtree contiguous.
     */
    function collectSubtreeMethods(node: N, kind: MethodKind, nodes: N[], methods: ListedMethod[], ends: number[]): void {
        // Read here rather than through a shared helper: measured, V8 did not
        // inline one, and the rebuild of a churning scene was 25% slower.
        const fields = visit(node);
        // An update method is only ever invoked by `updateView`, which always
        // passes a number (see `ListedMethod`).
        const method = (kind === UPDATE ? fields._mvtUpdateMethod : fields._mvtRefreshMethod) as ListedMethod | undefined;
        let selfIndex = -1;
        if (method !== undefined) {
            selfIndex = nodes.length;
            nodes.push(node);
            methods.push(method);
            ends.push(0); // Placeholder, overwritten once this subtree is collected.
        }
        const nodeChildren = children(node);
        for (let i = 0; i < nodeChildren.length; i++) {
            const child = nodeChildren[i];
            if (has(child, kind)) collectSubtreeMethods(child, kind, nodes, methods, ends);
        }
        if (selfIndex !== -1) ends[selfIndex] = nodes.length;
    }

    /**
     * Does this subtree hold any method of this kind?
     *
     * Deliberately visits every child instead of stopping at the first that
     * has one. Visiting them all is what caches them all, and that cache is
     * what makes a later skip a single field read. An early exit would
     * quietly turn every rebuild back into a walk of the whole subtree.
     */
    function has(node: N, kind: MethodKind): boolean {
        if (tickCounter.isCounting) tickCounter.rebuildNodeVisits++;
        const fields = visit(node);
        const cached = kind === UPDATE ? fields._mvtSubtreeHasUpdate : fields._mvtSubtreeHasRefresh;
        if (cached !== undefined) return cached;
        let found = (kind === UPDATE ? fields._mvtUpdateMethod : fields._mvtRefreshMethod) !== undefined;
        const nodeChildren = children(node);
        for (let i = 0; i < nodeChildren.length; i++) {
            if (has(nodeChildren[i], kind)) found = true;
        }
        if (kind === UPDATE) fields._mvtSubtreeHasUpdate = found;
        else fields._mvtSubtreeHasRefresh = found;
        return found;
    }
}

/**
 * An update or refresh method, as the loop calls it: with `deltaMs` when
 * updating, and `undefined` when refreshing. One call site for both.
 * `undefined`, not a placeholder number, so a refresh method that declares a
 * parameter without wrapping (one with a default value, which `setRefresh`
 * does not count) sees that default.
 */
type ListedMethod = (deltaMs: number | undefined) => typeof SKIP_DESCENDANTS | void;

// Which kind of method a shared helper is serving. A tiny discriminator keeps
// the collection, the presence cache and the invoke loop as one
// implementation each.
const UPDATE = 0;
const REFRESH = 1;
type MethodKind = typeof UPDATE | typeof REFRESH;

// Vite replaces `import.meta.env.DEV` at build time. Plain Node - which is how
// the benchmark harness runs - has no `import.meta.env` at all, so it is read
// defensively here rather than assumed.
const DEV = import.meta.env?.DEV === true;

/**
 * The largest refresh id before the ids wrap back to 1: the largest whose
 * encoded elisions still fit an `Int32Array`. An elision could only be
 * misread 2^29 refreshes later, over three months of frames at 60 fps.
 */
const MAX_REFRESH_ID = 0x1fffffff;

// What an invocation of a refresh method list elided at an entry, and why.
/** The entry and its descendants: the entry was detached. */
const ELIDED_DETACHED = 1;
/** The entry: its method was cleared earlier in the invocation. */
const ELIDED_METHOD_CLEARED = 2;
/** The entry's descendants: the entry ran and returned `SKIP_DESCENDANTS`. */
const ELIDED_DESCENDANTS = 3;
type ElisionKind = typeof ELIDED_DETACHED | typeof ELIDED_METHOD_CLEARED | typeof ELIDED_DESCENDANTS;

/**
 * An elision's record in `MethodList.elisions`: its kind, tagged with the
 * refresh's id, so a record left by an earlier refresh never matches. Zero,
 * a fresh array's value, matches no refresh, since ids start at 1.
 */
function encodeElision(id: number, kind: ElisionKind): number {
    return id * 4 + kind;
}

/**
 * How many rounds catching up a refresh may take. Each round runs only the
 * nodes the previous one added, so a real scene needs one or two; more means
 * methods are adding nodes that add nodes, without end.
 */
const MAX_CATCH_UP_ROUNDS = 100;

/** Whether a node set up by a copy with another protocol has been warned of. */
let hasWarnedOfForeignNode = false;

/**
 * The renderer that registered `node`'s prototype. Checked on every call, not
 * only in dev builds: the check is the read the dispatch needs anyway, and a
 * value of no installed renderer would otherwise fail with an opaque
 * `TypeError` far from its cause.
 */
function rendererOf(node: object, name: 'updateView' | 'refreshView'): Renderer {
    // Optional: a caller outside TypeScript may pass `undefined` or `null`
    const renderer = (node as NodeFields | undefined)?._mvtRenderer;
    if (renderer !== undefined) return renderer;
    throw new Error(
        `[mvt] ${name}() was given ${describeValue(node)}, which is not a view of any installed renderer. `
        + 'Import its renderer package, such as @mvtjs/pixi, before updating or refreshing its views, '
        + 'and keep one copy of the @mvtjs packages in the program.',
    );
}

/** Names a value of unknown kind in an error message. */
function describeValue(value: unknown): string {
    if (typeof value !== 'object' || !value) return String(value);
    const name = (value as { readonly constructor?: { readonly name?: unknown } }).constructor?.name;
    return typeof name === 'string' && name !== 'Object' ? `an object of class ${name}` : 'a plain object';
}

/**
 * A wrapping update method, bound to the one it replaces. Bound once, when it
 * is set, so invoking a method list calls every method the same way and pays
 * nothing for methods that do not wrap. A wrapper with nothing to wrap is
 * stored as it is: the loop gives it no second argument, which is
 * `undefined`.
 */
function bindPreviousUpdate(method: UpdateMethodOrWrapper, previous: UpdateMethod): UpdateMethod {
    return (deltaMs) => method(deltaMs, previous);
}

/**
 * A wrapping refresh method, bound to the one it replaces, as
 * `bindPreviousUpdate`. A wrapper with nothing to wrap is stored as it is:
 * the loop calls it with `undefined` (see `ListedMethod`).
 */
function bindPreviousRefresh(method: RefreshMethodOrWrapper, previous: RefreshMethod): RefreshMethod {
    return () => method(previous);
}

function fieldsOf(node: object): NodeFields {
    return node as NodeFields;
}
