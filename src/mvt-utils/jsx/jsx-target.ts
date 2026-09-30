import type { SceneNode } from '..';
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
 * `N` is the renderer's node type, a {@link SceneNode}: the base keeps each
 * element's bindings in its `onRefresh` method.
 */
export interface JsxTarget<N extends SceneNode> {
    /** Names the runtime in error messages, e.g. `'pixi-mvt/jsx'`. */
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
     * Adds an event listener, for event attributes. Called on a new element,
     * before its other attributes are applied, so it may set defaults that
     * make the listener work, and an attribute can still override them.
     */
    listen: (node: N, eventName: string, handler: (event: never) => void) => void;

    /**
     * The renderer's `refreshScene`: calls every `onRefresh` in `node`'s
     * subtree, a node's before its descendants'. `<List>` and `<Switch>` call
     * it on nodes they build during a refresh, which that refresh's list of
     * nodes does not include, so they show that frame.
     */
    refreshScene: (node: N) => void;
}
