import type { UpdateMethod } from '../scene-methods';
import type { SKIP_DESCENDANTS } from '../skip-descendants';
import type { ChangeableAttribute, ElementDefinition, EventAttribute, FixedAttribute } from './attributes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A fixed value, or a getter the view calls every frame. The type of every
 * intrinsic element's changeable attributes, and of any view's query binding
 * that accepts either kind of answer.
 */
export type ValueOrGetter<T> = T | (() => T);

/** Callback ref - invoked once after the element is fully constructed. */
export type RefCallback<E> = (el: E) => void;

/**
 * An `onRefresh` attribute: a per-frame step of the element's own, for what
 * attributes cannot express, such as redrawing a Pixi `Graphics` when a value
 * changes. Receives the element, like a ref. Runs after the element's
 * function attributes, and not at all while a `visible` function hides the
 * element. May return `SKIP_DESCENDANTS`.
 */
export type RefreshStep<E> = (el: E) => typeof SKIP_DESCENDANTS | void;

/**
 * An `onDestroyed` attribute: releases what the view made for this element
 * and that nothing else frees, such as a window listener or a shared
 * resource. Runs when the element is destroyed, by the JSX target's `destroy` on
 * it or on an ancestor. On Pixi, that is its `'destroyed'` event, once the
 * element's children are detached but before they are destroyed, and only if
 * the element itself is destroyed: an ancestor destroyed without
 * `{ children: true }` detaches it instead.
 */
export type DestroyedCallback<E> = (el: E) => void;

/** What JSX children may be, for a JSX target whose nodes are `N`. */
export type JsxChildren<N> = N | JsxChildList<N>;

// Children may be `null` as well as `undefined`, as they always could be here
// (and as JSX habitually writes them), even though the repo otherwise avoids
// `null`.
export type JsxChildList<N> = (N | JsxChildList<N> | undefined | null)[];

/**
 * The attributes the base gives every intrinsic element of every JSX target: the
 * MVT parts of an element. `E` is the element's own type, `N` the JSX target's
 * node type.
 */
export interface MvtAttributes<E, N> {
    /**
     * Whether the element is shown. A function is evaluated first on each
     * refresh, and while it is false the element's other bindings and its
     * whole subtree are skipped.
     */
    visible?: ValueOrGetter<boolean>;
    /** Installed as the element's update method. */
    onUpdate?: UpdateMethod;
    onRefresh?: RefreshStep<E>;
    onDestroyed?: DestroyedCallback<E>;
    ref?: RefCallback<E>;
    children?: JsxChildren<N>;
}

/**
 * The value an attribute definition accepts in JSX: its value for a fixed
 * attribute, a value or a getter for a changeable one, and a handler for an
 * event.
 */
export type AttributeValue<D> =
    D extends FixedAttribute<never, infer T> ? T
        : D extends ChangeableAttribute<never, infer T> ? ValueOrGetter<T>
            : D extends EventAttribute<infer Ev> ? (event: Ev) => void
                : never;

/** The JSX attributes of an element table's attribute record, all optional. */
export type AttributesOf<A> = { [K in keyof A]?: AttributeValue<A[K]> };

/**
 * The JSX attributes an element's patterns accept: for a pattern with the
 * prefix `data-`, any attribute named `data-` and more.
 *
 * TypeScript never checks a hyphenated JSX attribute (`data-count`) against
 * an index signature such as these, so in JSX their values are not checked;
 * outside JSX, and for names without a hyphen, they are.
 */
export type PatternAttributesOf<P> = {
    [K in keyof P & string as `${K}${string}`]?: P[K] extends (name: string) => infer D ? AttributeValue<D> : never;
};

/**
 * `JSX.IntrinsicElements` for a JSX target whose nodes are `N`, derived from its
 * element table, so the attribute types cannot disagree with what the
 * runtime does with them.
 */
export type IntrinsicElementsOf<N, T> = {
    [K in keyof T]: T[K] extends ElementDefinition<infer E, infer A, infer P>
        ? AttributesOf<A> & PatternAttributesOf<P> & MvtAttributes<E, N>
        : never;
};
