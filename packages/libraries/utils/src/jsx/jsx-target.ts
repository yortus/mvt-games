import type { ChangeableAttribute } from './attributes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A renderer's scene graph as the JSX base needs it: the operations the base
 * performs on its nodes (grouping, adding, replacing, detaching, destroying,
 * listening) and the attribute that shows and hides them. Nothing else about
 * a renderer reaches the base.
 *
 * `N` is the renderer's node type, and `R` is the type of resource that an
 * element's `owns` attribute may list. The base doesn't depend on either
 * type. It keeps each element's bindings in its refresh method, set with
 * `setRefresh`, which the renderer's `refreshView` calls. The renderer
 * registers its nodes with `registerRenderer`, and the base doesn't depend
 * on that either.
 */
export interface JsxTarget<N extends object, R = never> {
    /** Names the runtime in error messages, e.g. `'@mvtjs/pixi'`. */
    readonly name: string;

    /**
     * An empty node that groups its children without changing how they show:
     * not their layout, position or draw order. Used for fragments, and by
     * `<List>`, `<Switch>` and `<Match>`.
     */
    createGroup: () => N;
    /** Adds `child` after `parent`'s last child. */
    append: (parent: N, child: N) => void;
    /** Puts `next` where `current` is among `parent`'s children, and detaches `current`. */
    replace: (parent: N, current: N, next: N) => void;
    /** Detaches `parent`'s last `count` children, without destroying them. */
    detachTail: (parent: N, count: number) => void;

    /**
     * The `visible` attribute. The base evaluates it first, and skips a hidden
     * element's other bindings and subtree. `<List>` and `<Switch>` hide nodes
     * with it. A new node must start visible. Written every frame, since
     * `<List>` and `<Switch>` write it behind a binding's back (design notes,
     * decision 10); a JSX target whose write is costly compares first.
     */
    visible: ChangeableAttribute<N, boolean>;

    /** Destroys `node` and its subtree, running every `onDestroyed` callback in it, and detaches it. */
    destroy: (node: N) => void;
    /** Runs `callback` when `node` is destroyed, by `destroy` on it or on an ancestor. */
    onDestroyed: (node: N, callback: (node: N) => void) => void;
    /**
     * Frees a resource that an element's `owns` attribute lists, such as a
     * texture. The base calls it from `onDestroyed`, so it may run before
     * the node's children are destroyed, while they still hold the
     * resource. Freeing it must leave the children safe to destroy.
     */
    release: (resource: R) => void;

    /**
     * Adds an event listener, for event attributes. Called on a new element,
     * before its other attributes are applied, so it may set defaults that
     * make the listener work, and an attribute can still override them.
     */
    listen: (node: N, eventName: string, handler: (event: never) => void) => void;
}
