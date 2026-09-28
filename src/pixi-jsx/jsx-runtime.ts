/**
 * Custom JSX runtime that targets Pixi.js scene-graph construction.
 *
 * - Renders once (no diffing/reconciliation).
 * - Function-valued attributes become dynamic bindings polled each frame via
 *   the element's `onRefresh` method (driven by `refreshScene` from
 *   `pixi-mvt`), with simple equality change-detection.
 * - Construction is inert: static attributes are applied at once, but no getter
 *   runs until the element's first refresh. Until then a bound property holds
 *   Pixi's default. Hosts refresh the whole scene before every render, and
 *   `<List>`/`<Switch>` refresh whatever they build mid-pass, so nothing is
 *   ever drawn with defaults. Code that reads a bound property straight after
 *   construction should call `refreshScene` on the tree first.
 * - A `visible` binding is evaluated first, and a hidden element skips its
 *   other bindings and its whole subtree via `SKIP_DESCENDANTS`.
 * - An `onRefresh` attribute adds a per-frame step of the element's own, which
 *   receives the element and runs after its bindings (and is skipped with them
 *   while it is hidden).
 * - An `onDestroyed` attribute runs when the element is destroyed, to release
 *   what the view made for it.
 * - The `<List>` and `<Switch>` components (`list.ts`, `switch.ts`) cover
 *   dynamic structure: index-addressed slots, and slots whose shape varies.
 *
 * Why there are no cleanup scopes or context providers, as SolidJS has:
 * `design-notes.md`.
 */

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Cursor, EventMode, FederatedEvent, FederatedPointerEvent, FederatedWheelEvent, IHitArea, Texture } from 'pixi.js';
import { readCounter, type RefreshMethod, SKIP_DESCENDANTS, type UpdateMethod } from '../pixi-mvt';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Container;

    interface IntrinsicElements {
        container: BaseAttributes;
        sprite: SpriteAttributes;
        text: TextAttributes;
        graphics: GraphicsAttributes;
    }
}

/**
 * A fixed value, or a getter the view calls every frame. The type of every
 * intrinsic element's changeable attributes, and of any view's query binding
 * that accepts either kind of answer.
 */
export type ValueOrGetter<T> = T | (() => T);

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const Fragment = Symbol.for('pixi-jsx.fragment');

export function jsx(
    type: string | typeof Fragment | ((attributes: Record<string, unknown>) => Container),
    attributes: Record<string, unknown>,
): Container {
    // Component functions. The runtime calls `ref` on whatever the component
    // returns, so components must never consume `ref` themselves.
    if (typeof type === 'function') {
        const el = type(attributes);
        if (typeof attributes.ref === 'function') {
            (attributes.ref as RefCallback<Container>)(el);
        }
        return el;
    }

    // Fragment
    if (type === Fragment) {
        const container = new Container();
        addChildren(container, attributes.children);
        return container;
    }

    // Standard elements: container, sprite, text, graphics
    const el = createElement(type);
    const cheap: DynamicBinding[] = [];
    const watched: DynamicBinding[] = [];

    for (const key in attributes) {
        if (key === 'children' || key === 'ref' || key === 'onRefresh' || key === 'onDestroyed') continue;
        const value = attributes[key];
        if (isGetter(key, value)) {
            // Inert construction: record the getter but do not call it. Its
            // first evaluation is the element's first refresh, which runs only
            // once the whole tree exists, so an ancestor that hides or skips
            // this element (a `visible` binding, an empty `<List>` slot, an
            // unselected branch) can keep a binding that is not yet valid from
            // ever running.
            if (WATCHED_ATTRIBUTES.has(key)) {
                watched.push({ key, getter: value });
            }
            else if (key === 'visible') {
                // Evaluated first, so a hidden element skips everything else
                cheap.unshift({ key, getter: value });
            }
            else {
                cheap.push({ key, getter: value });
            }
        }
        else {
            applyAttribute(el, key, value);
        }
    }

    addChildren(el, attributes.children);
    applyEventAttributes(el, attributes);

    if (cheap.length > 0 || watched.length > 0) {
        setupDynamicRefresh(el, cheap, watched);
    }

    if (typeof attributes.onRefresh === 'function') {
        addRefreshStep(el, attributes.onRefresh as RefreshStep<Container>);
    }

    if (typeof attributes.onDestroyed === 'function') {
        // Pixi passes the element to `'destroyed'` listeners
        el.on('destroyed', attributes.onDestroyed as DestroyedCallback<Container>);
    }

    if (typeof attributes.ref === 'function') {
        (attributes.ref as RefCallback<Container>)(el);
    }

    return el;
}

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// --- Attributes accepted by the intrinsic elements ------------------------

interface SpriteAttributes extends BaseAttributes<Sprite> {
    texture?: ValueOrGetter<Texture>;
    tint?: ValueOrGetter<number>;
    anchor?: number;
    anchorX?: number;
    anchorY?: number;
    width?: ValueOrGetter<number>;
    height?: ValueOrGetter<number>;
}

interface TextAttributes extends BaseAttributes<Text> {
    text?: ValueOrGetter<string>;
    style?: Record<string, unknown>;
    anchor?: number;
    anchorX?: number;
    anchorY?: number;
}

interface GraphicsAttributes extends BaseAttributes<Graphics> {
    tint?: ValueOrGetter<number>;
}

/**
 * Attributes every intrinsic element accepts. `T` is the element's own type,
 * which `ref`, `onRefresh` and `onDestroyed` receive.
 */
interface BaseAttributes<T extends Container = Container> extends EventAttributes {
    x?: ValueOrGetter<number>;
    y?: ValueOrGetter<number>;
    alpha?: ValueOrGetter<number>;
    visible?: ValueOrGetter<boolean>;
    rotation?: ValueOrGetter<number>;
    scale?: ValueOrGetter<number>;
    scaleX?: ValueOrGetter<number>;
    scaleY?: ValueOrGetter<number>;
    pivotX?: ValueOrGetter<number>;
    pivotY?: ValueOrGetter<number>;
    zIndex?: ValueOrGetter<number>;
    sortableChildren?: boolean;
    isRenderGroup?: boolean;
    hitArea?: IHitArea;
    /**
     * How the element takes part in pointer events. Without it, an element
     * with an event handler attribute is made `'static'`.
     */
    eventMode?: EventMode;
    cursor?: ValueOrGetter<Cursor>;
    label?: string;
    onUpdate?: UpdateMethod;
    onRefresh?: RefreshStep<T>;
    onDestroyed?: DestroyedCallback<T>;
    ref?: RefCallback<T>;
    children?: PixiNode | PixiChildren;
}

interface EventAttributes {
    onPointerDown?: (e: FederatedPointerEvent) => void;
    onPointerUp?: (e: FederatedPointerEvent) => void;
    onPointerUpOutside?: (e: FederatedPointerEvent) => void;
    onPointerCancel?: (e: FederatedPointerEvent) => void;
    onPointerTap?: (e: FederatedPointerEvent) => void;
    onPointerOver?: (e: FederatedPointerEvent) => void;
    onPointerOut?: (e: FederatedPointerEvent) => void;
    onPointerMove?: (e: FederatedPointerEvent) => void;
    onGlobalPointerMove?: (e: FederatedPointerEvent) => void;
    onWheel?: (e: FederatedWheelEvent) => void;
}

/** Callback ref - invoked once after the element is fully constructed. */
type RefCallback<T> = (el: T) => void;

/**
 * An `onDestroyed` attribute: releases what the view made for this element
 * and that nothing else frees, such as a window listener or a shared
 * `GraphicsContext`. Runs on Pixi's `'destroyed'` event, once the element's
 * children are detached but before they are destroyed. Runs only if the
 * element itself is destroyed: an ancestor destroyed without
 * `{ children: true }` detaches it instead.
 */
type DestroyedCallback<T> = (el: T) => void;

/**
 * An `onRefresh` attribute: a per-frame step of the element's own, for what
 * attributes cannot express, such as redrawing a `Graphics` when a value
 * changes. Receives the element, like a ref. Runs after the element's
 * function attributes, and not at all while a `visible` function hides the
 * element. May return `SKIP_DESCENDANTS`.
 */
type RefreshStep<T> = (el: T) => typeof SKIP_DESCENDANTS | void;

type PixiChildren = (PixiNode | PixiChildren | undefined | null)[];

type PixiNode = Container;

// --- Refresh machinery -----------------------------------------------------

interface DynamicBinding {
    key: string;
    getter: () => unknown;
}

/**
 * A codegen'd refresh factory. Called once per element with the element, the
 * skip sentinel, the `UNSET` marker, the read counter and the
 * element's getters as separate arguments, it returns that element's refresh
 * method. The method calls each
 * getter it captured directly and keeps each watched binding's last value in
 * a closure local, so a refresh involves no array lookups and no second call.
 * Measured on 1000 elements with three bindings, one design per process (V8
 * shares inline caches between designs run in one process, which skews the
 * comparison): 7.8 us per frame, against 9.9 us for the previous design (a
 * method calling a shared body with an array of getters) and 5.6 us for
 * hand-written refresh methods. The remaining ~2 ns per element is the cost of calling
 * getters at all, confirmed by CPU profile.
 */
type RefreshFactory = (...args: unknown[]) => () => typeof SKIP_DESCENDANTS | void;

/**
 * The "last value" of a watched binding before its first refresh. Unequal to
 * anything a getter can return, so the first refresh always writes. Bindings
 * are never evaluated at construction (see `jsx`), so there is no real initial
 * value to seed with.
 */
const UNSET: unique symbol = Symbol('pixi-jsx.unset');

/**
 * Attributes that are expensive to set on every tick and should only be written
 * when the value actually changes. Everything else is cheap enough (a number
 * or boolean assignment plus a dirty flag) to set unconditionally each frame.
 */
const WATCHED_ATTRIBUTES = new Set(['text', 'style', 'texture', 'tint', 'width', 'height', 'label']);

/**
 * Watched attributes whose values are numbers that may be fractional. Their
 * last value is kept in a `Float64Array` that starts as `NaN`, not in a closure
 * variable that starts as `UNSET`. V8 boxes a fractional number in a new heap
 * object when it is stored in a closure variable, and when it is compared with
 * one that might hold a symbol: 16 bytes per element per frame for a
 * fractional `width`, changed or not. `NaN` is unequal to everything, so the
 * first refresh still always writes. `tint` is a colour, a whole number, which
 * V8 stores without boxing.
 */
const FRACTIONAL_WATCHED_ATTRIBUTES = new Set(['width', 'height']);

/** Attributes that are functions but should NOT be treated as dynamic getters. */
const NON_GETTER_ATTRIBUTES = new Set(['ref', 'onUpdate']);

/** Attributes that are Pixi event handlers wired once at construction time. */
const EVENT_ATTRIBUTE_MAP: Record<string, string> = {
    onPointerDown: 'pointerdown',
    onPointerUp: 'pointerup',
    onPointerUpOutside: 'pointerupoutside',
    onPointerCancel: 'pointercancel',
    onPointerTap: 'pointertap',
    onPointerOver: 'pointerover',
    onPointerOut: 'pointerout',
    onPointerMove: 'pointermove',
    onGlobalPointerMove: 'globalpointermove',
    onWheel: 'wheel',
};

/**
 * Compiled refresh factories keyed by binding signature. The generated source
 * depends only on the ordered cheap keys and the ordered watched keys, so
 * building the thousandth list item with a given shape costs a map lookup
 * rather than a JIT compile. Bounded by the number of distinct binding shapes
 * written in source, so it never needs evicting.
 */
const refreshFactoryCache = new Map<string, RefreshFactory>();

// --- Helpers, in the order `jsx` uses them ---------------------------------

function createElement(kind: string): Container {
    switch (kind) {
        case 'container': return new Container();
        case 'sprite': return new Sprite();
        case 'text': return new Text();
        case 'graphics': return new Graphics();
        default: throw new Error(`Unknown pixi-jsx element: <${kind}>`);
    }
}

function isGetter(key: string, value: unknown): value is () => unknown {
    return typeof value === 'function' && !NON_GETTER_ATTRIBUTES.has(key) && !isEventAttribute(key);
}

function isEventAttribute(key: string): boolean {
    return key in EVENT_ATTRIBUTE_MAP;
}

/** Apply a single attribute to a Pixi display object. */
function applyAttribute(el: Container, key: string, value: unknown): void {
    switch (key) {
        case 'x':
            el.x = value as number;
            break;
        case 'y':
            el.y = value as number;
            break;
        case 'alpha':
            el.alpha = value as number;
            break;
        case 'visible':
            el.visible = value as boolean;
            break;
        case 'rotation':
            el.rotation = value as number;
            break;
        case 'pivotX':
            el.pivot.x = value as number;
            break;
        case 'pivotY':
            el.pivot.y = value as number;
            break;
        case 'scale':
            el.scale.set(value as number);
            break;
        case 'scaleX':
            el.scale.x = value as number;
            break;
        case 'scaleY':
            el.scale.y = value as number;
            break;
        case 'anchor':
            if ('anchor' in el) (el as Sprite).anchor.set(value as number);
            break;
        case 'anchorX':
            if ('anchor' in el) (el as Sprite).anchor.x = value as number;
            break;
        case 'anchorY':
            if ('anchor' in el) (el as Sprite).anchor.y = value as number;
            break;
        case 'texture':
            if (el instanceof Sprite) el.texture = value as Texture;
            break;
        case 'tint':
            if (el instanceof Sprite || el instanceof Graphics) el.tint = value as number;
            break;
        case 'width':
            el.width = value as number;
            break;
        case 'height':
            el.height = value as number;
            break;
        case 'text':
            if (el instanceof Text) el.text = value as string;
            break;
        case 'style':
            if (el instanceof Text) Object.assign(el.style, value as Record<string, unknown>);
            break;
        case 'label':
            el.label = value as string;
            break;
        case 'hitArea':
            el.hitArea = value as IHitArea;
            break;
        case 'eventMode':
            el.eventMode = value as EventMode;
            break;
        case 'cursor':
            el.cursor = value as Cursor;
            break;
        case 'onUpdate':
            el.onUpdate = value as UpdateMethod | undefined;
            break;
        default:
            // Fallback: direct property set (unsafe but extensible)
            (el as unknown as Record<string, unknown>)[key] = value;
    }
}

function addChildren(parent: Container, children: unknown): void {
    if (children == null) return;
    if (Array.isArray(children)) {
        for (let i = 0; i < children.length; i++) {
            addChildren(parent, children[i]);
        }
    }
    else {
        parent.addChild(children as Container);
    }
}

/**
 * Wire event handler attributes onto an element, making it interactive. An
 * `eventMode` attribute has already been applied with the others, and wins.
 */
function applyEventAttributes(el: Container, attributes: Record<string, unknown>): void {
    let hasEventMode = attributes.eventMode !== undefined;
    for (const key in EVENT_ATTRIBUTE_MAP) {
        const handler = attributes[key];
        if (typeof handler === 'function') {
            if (!hasEventMode) {
                el.eventMode = 'static';
                hasEventMode = true;
            }
            el.on(EVENT_ATTRIBUTE_MAP[key], handler as (e: FederatedEvent) => void);
        }
    }
}

/**
 * Add an `onRefresh` attribute's step to an element. With function attributes
 * as well, the step runs after them, unless a `visible` function has just hidden
 * the element.
 */
function addRefreshStep(el: Container, step: RefreshStep<Container>): void {
    const ownRefresh: RefreshMethod | undefined = el.onRefresh;
    el.onRefresh = ownRefresh === undefined
        ? () => step(el)
        : () => (ownRefresh() === SKIP_DESCENDANTS ? SKIP_DESCENDANTS : step(el));
}

/** Wire up a codegen'd per-frame refresh for dynamic bindings on an element. */
function setupDynamicRefresh(
    el: Container,
    cheap: DynamicBinding[],
    watched: DynamicBinding[],
): void {
    const factory = getRefreshFactory(cheap, watched);

    // Construction only, so building this argument list is off the hot path.
    const args: unknown[] = [el, SKIP_DESCENDANTS, UNSET, readCounter];
    for (let i = 0; i < cheap.length; i++) args.push(cheap[i].getter);
    for (let i = 0; i < watched.length; i++) args.push(watched[i].getter);

    el.onRefresh = factory(...args);
}

/**
 * Get the codegen'd refresh factory for a binding signature, compiling it on
 * first use. The methods it makes apply all cheap bindings unconditionally and
 * watched bindings only on change - with zero loops or switch dispatch at
 * runtime. A `visible` binding is always first in `cheap` (see `jsx`), and
 * returns the skip sentinel when false so a hidden element skips its other
 * bindings and its subtree.
 *
 * Generated shape, for `x` (cheap), and `text` and `width` (watched):
 *
 *     function (e, s, u, c, g0, g1, g2) {
 *         var v0 = u;
 *         var n = new Float64Array(1).fill(NaN);
 *         return function () {
 *             if (c.isCounting) c.count += 3;
 *             e.x = g0();
 *             var _0 = g1(); if (_0 !== v0) { v0 = _0; e.text = _0; }
 *             var _1 = g2(); if (_1 !== n[0]) { n[0] = _1; e.width = _1; }
 *         };
 *     }
 *
 * `width` keeps its last value in `n`, not a closure variable; see
 * {@link FRACTIONAL_WATCHED_ATTRIBUTES}.
 *
 * With a `visible` binding, the count is split around the visibility check,
 * so a hidden element counts only the one read it made.
 *
 * Safe: attribute keys originate from JSX intrinsic element type definitions,
 * not from user input.
 */
function getRefreshFactory(cheap: DynamicBinding[], watched: DynamicBinding[]): RefreshFactory {
    let signature = '';
    for (let i = 0; i < cheap.length; i++) signature += cheap[i].key + ',';
    signature += '|';
    for (let i = 0; i < watched.length; i++) signature += watched[i].key + ',';

    let factory = refreshFactoryCache.get(signature);
    if (factory !== undefined) return factory;

    const params = ['e', 's', 'u', 'c'];
    const locals: string[] = [];
    const body: string[] = [];
    let gi = 0;

    const readCount = cheap.length + watched.length;
    const hasVisible = cheap.length > 0 && cheap[0].key === 'visible';
    if (!hasVisible) body.push(`if(c.isCounting)c.count+=${readCount};`);

    for (let i = 0; i < cheap.length; i++) {
        params.push(`g${gi}`);
        if (cheap[i].key === 'visible') {
            body.push('if(c.isCounting)c.count++;', `e.visible=g${gi}();`, 'if(!e.visible)return s;');
            if (readCount > 1) body.push(`if(c.isCounting)c.count+=${readCount - 1};`);
        }
        else {
            body.push(attributeAssignment(cheap[i].key, `g${gi}()`) + ';');
        }
        gi++;
    }

    let numericCount = 0;
    for (let i = 0; i < watched.length; i++) {
        params.push(`g${gi}`);
        // Where the last value written is kept.
        let last: string;
        if (FRACTIONAL_WATCHED_ATTRIBUTES.has(watched[i].key)) {
            last = `n[${numericCount++}]`;
        }
        else {
            last = `v${i}`;
            locals.push(`var v${i}=u;`);
        }
        body.push(
            `var _${i}=g${gi}();`,
            `if(_${i}!==${last}){${last}=_${i};${attributeAssignment(watched[i].key, `_${i}`)}}`,
        );
        gi++;
    }
    if (numericCount > 0) locals.push(`var n=new Float64Array(${numericCount}).fill(NaN);`);

    const source = `${locals.join('\n')}\nreturn function(){\n${body.join('\n')}\n};`;

    // Safe: attribute keys come from JSX intrinsic element type definitions.
    factory = new Function(...params, source) as RefreshFactory;
    refreshFactoryCache.set(signature, factory);
    return factory;
}

/**
 * Map an attribute key to its inline JS assignment expression. Most
 * attributes are simple `e.key=val`; a few need special handling for nested
 * properties or method calls.
 */
function attributeAssignment(key: string, val: string): string {
    switch (key) {
        case 'pivotX': return `e.pivot.x=${val}`;
        case 'pivotY': return `e.pivot.y=${val}`;
        case 'scale': return `e.scale.set(${val})`;
        case 'scaleX': return `e.scale.x=${val}`;
        case 'scaleY': return `e.scale.y=${val}`;
        case 'anchor': return `e.anchor.set(${val})`;
        case 'style': return `Object.assign(e.style,${val})`;
        default: return `e.${key}=${val}`;
    }
}
