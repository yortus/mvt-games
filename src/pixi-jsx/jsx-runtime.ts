/**
 * Custom JSX runtime that targets Pixi.js scene-graph construction.
 *
 * - Renders once (no diffing/reconciliation).
 * - Function-valued props become dynamic bindings polled each frame via the
 *   element's `onRefresh` hook (driven by `refreshScene` from `pixi-mvt`),
 *   with simple equality change-detection.
 * - A `visible` binding is evaluated first, and a hidden element skips its
 *   other bindings and its whole subtree via `SKIP_DESCENDANTS`.
 * - The `<List>` component manages a dynamic set of children driven by a
 *   getter that returns the current array of items.
 */

import { Container, type FederatedPointerEvent, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { SKIP_DESCENDANTS } from '../pixi-mvt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A prop value may be a static literal or a getter polled each frame. */
type MaybeGetter<T> = T | (() => T);

interface EventProps {
    onPointerDown?: (e: FederatedPointerEvent) => void;
    onPointerUp?: (e: FederatedPointerEvent) => void;
    onPointerTap?: (e: FederatedPointerEvent) => void;
    onPointerOver?: (e: FederatedPointerEvent) => void;
    onPointerOut?: (e: FederatedPointerEvent) => void;
}

/** Callback ref - invoked once after the element is fully constructed. */
type RefCallback<T> = (el: T) => void;

interface BaseProps extends EventProps {
    x?: MaybeGetter<number>;
    y?: MaybeGetter<number>;
    alpha?: MaybeGetter<number>;
    visible?: MaybeGetter<boolean>;
    rotation?: MaybeGetter<number>;
    scale?: MaybeGetter<number>;
    pivotX?: MaybeGetter<number>;
    pivotY?: MaybeGetter<number>;
    label?: string;
    children?: PixiNode | PixiChildren;
}

type PixiChildren = (PixiNode | PixiChildren | undefined | null)[];

interface ContainerProps extends BaseProps {
    ref?: RefCallback<Container>;
}

interface SpriteProps extends BaseProps {
    texture?: MaybeGetter<Texture>;
    tint?: MaybeGetter<number>;
    anchor?: number;
    width?: MaybeGetter<number>;
    height?: MaybeGetter<number>;
    ref?: RefCallback<Sprite>;
}

interface TextProps extends BaseProps {
    text?: MaybeGetter<string>;
    style?: Record<string, unknown>;
    ref?: RefCallback<Text>;
}

interface GraphicsProps extends BaseProps {
    ref?: RefCallback<Graphics>;
}

type PixiNode = Container;

// ---------------------------------------------------------------------------
// JSX namespace (consumed by TypeScript for type-checking)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Container;

    interface IntrinsicElements {
        container: ContainerProps;
        sprite: SpriteProps;
        text: TextProps;
        graphics: GraphicsProps;
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DynamicBinding {
    key: string;
    getter: () => unknown;
}

interface WatchedBinding {
    key: string;
    getter: () => unknown;
    lastValue: unknown;
}

/**
 * Props that are expensive to set on every tick and should only be written
 * when the value actually changes. Everything else is cheap enough (a number
 * or boolean assignment plus a dirty flag) to set unconditionally each frame.
 */
const WATCHED_PROPS = new Set(['text', 'style', 'texture', 'width', 'height', 'label']);

function createElement(kind: string): Container {
    switch (kind) {
        case 'container': return new Container();
        case 'sprite': return new Sprite();
        case 'text': return new Text();
        case 'graphics': return new Graphics();
        default: throw new Error(`Unknown pixi-jsx element: <${kind}>`);
    }
}

/** Apply a single prop to a Pixi display object. */
function applyProp(el: Container, key: string, value: unknown): void {
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
        case 'anchor':
            if ('anchor' in el) (el as Sprite).anchor.set(value as number);
            break;
        case 'texture':
            if (el instanceof Sprite) el.texture = value as Texture;
            break;
        case 'tint':
            if (el instanceof Sprite) el.tint = value as number;
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
        default:
            // Fallback: direct property set (unsafe but extensible)
            (el as unknown as Record<string, unknown>)[key] = value;
    }
}

/** Props that are functions but should NOT be treated as dynamic getters. */
const NON_GETTER_PROPS = new Set(['view', 'of', 'ref']);

/** Props that are Pixi event handlers wired once at construction time. */
const EVENT_PROP_MAP: Record<string, string> = {
    onPointerDown: 'pointerdown',
    onPointerUp: 'pointerup',
    onPointerTap: 'pointertap',
    onPointerOver: 'pointerover',
    onPointerOut: 'pointerout',
};

function isEventProp(key: string): boolean {
    return key in EVENT_PROP_MAP;
}

function isGetter(key: string, value: unknown): value is () => unknown {
    return typeof value === 'function' && !NON_GETTER_PROPS.has(key) && !isEventProp(key);
}

/** Wire event handler props onto an element, enabling interaction. */
function applyEventProps(el: Container, props: Record<string, unknown>): void {
    let hasEvents = false;
    for (const key in EVENT_PROP_MAP) {
        const handler = props[key];
        if (typeof handler === 'function') {
            if (!hasEvents) {
                el.eventMode = 'static';
                hasEvents = true;
            }
            el.on(EVENT_PROP_MAP[key], handler as (e: FederatedPointerEvent) => void);
        }
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
 * Map a prop key to its inline JS assignment expression. Most props are
 * simple `e.key=val`; a few need special handling for nested properties
 * or method calls.
 */
function propAssign(key: string, val: string): string {
    switch (key) {
        case 'pivotX': return `e.pivot.x=${val}`;
        case 'pivotY': return `e.pivot.y=${val}`;
        case 'scale': return `e.scale.set(${val})`;
        case 'anchor': return `e.anchor.set(${val})`;
        case 'style': return `Object.assign(e.style,${val})`;
        default: return `e.${key}=${val}`;
    }
}

/**
 * A codegen'd refresh body. Parameterised over everything element-specific
 * (the element, its getters, its last watched values, and the skip sentinel),
 * so one compiled function serves every element with the same binding
 * signature.
 */
type CompiledRefresh = (
    e: Container,
    g: (() => unknown)[],
    v: unknown[],
    s: typeof SKIP_DESCENDANTS,
) => typeof SKIP_DESCENDANTS | void;

/**
 * Compiled refresh bodies keyed by binding signature. The generated source
 * depends only on the ordered cheap keys and the ordered watched keys, so
 * building the thousandth list item with a given shape costs a map lookup
 * rather than a JIT compile. Bounded by the number of distinct binding shapes
 * written in source, so it never needs evicting.
 */
const compiledRefreshCache = new Map<string, CompiledRefresh>();

/**
 * Get the codegen'd refresh function for a binding signature, compiling it on
 * first use. It applies all cheap bindings unconditionally and watched bindings
 * only on change - with zero loops or switch dispatch at runtime. A `visible`
 * binding is always first in `cheap` (see `jsx`), and returns the skip sentinel
 * when false so a hidden element skips its other bindings and its subtree.
 *
 * Safe: prop keys originate from JSX intrinsic element type definitions,
 * not from user input.
 */
function getCompiledRefresh(cheap: DynamicBinding[], watched: WatchedBinding[]): CompiledRefresh {
    let signature = '';
    for (let i = 0; i < cheap.length; i++) signature += cheap[i].key + ',';
    signature += '|';
    for (let i = 0; i < watched.length; i++) signature += watched[i].key + ',';

    let fn = compiledRefreshCache.get(signature);
    if (fn !== undefined) return fn;

    const lines: string[] = [];
    let gi = 0;

    for (let i = 0; i < cheap.length; i++) {
        if (cheap[i].key === 'visible') {
            lines.push(`e.visible=g[${gi}]();`, 'if(!e.visible)return s;');
        }
        else {
            lines.push(propAssign(cheap[i].key, `g[${gi}]()`) + ';');
        }
        gi++;
    }

    for (let i = 0; i < watched.length; i++) {
        lines.push(
            `var _${i}=g[${gi}]();`,
            `if(_${i}!==v[${i}]){v[${i}]=_${i};${propAssign(watched[i].key, `_${i}`)}}`,
        );
        gi++;
    }

    // Safe: prop keys originate from JSX intrinsic element type definitions.
    fn = new Function('e', 'g', 'v', 's', lines.join('\n')) as CompiledRefresh;
    compiledRefreshCache.set(signature, fn);
    return fn;
}

/** Wire up a codegen'd per-frame refresh for dynamic bindings on an element. */
function setupDynamicRefresh(
    el: Container,
    cheap: DynamicBinding[],
    watched: WatchedBinding[],
): void {
    const fn = getCompiledRefresh(cheap, watched);

    const getters: (() => unknown)[] = [];
    const lastValues: unknown[] = [];
    for (let i = 0; i < cheap.length; i++) getters.push(cheap[i].getter);
    for (let i = 0; i < watched.length; i++) {
        getters.push(watched[i].getter);
        lastValues.push(watched[i].lastValue);
    }

    // One closure per element: the compiled body is shared.
    el.onRefresh = () => fn(el, getters, lastValues, SKIP_DESCENDANTS);
}

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

export const Fragment = Symbol.for('pixi-jsx.fragment');

// ---------------------------------------------------------------------------
// JSX factory (automatic runtime: jsx / jsxs)
// ---------------------------------------------------------------------------

export function jsx(
    type: string | typeof Fragment | ((props: Record<string, unknown>) => Container),
    props: Record<string, unknown>,
): Container {
    // Component functions
    if (typeof type === 'function') {
        return type(props);
    }

    // Fragment
    if (type === Fragment) {
        const container = new Container();
        addChildren(container, props.children);
        return container;
    }

    // Standard elements: container, sprite, text, graphics
    const el = createElement(type);
    const cheap: DynamicBinding[] = [];
    const watched: WatchedBinding[] = [];

    for (const key in props) {
        if (key === 'children' || key === 'ref') continue;
        const value = props[key];
        if (isGetter(key, value)) {
            const initial = value();
            if (WATCHED_PROPS.has(key)) {
                watched.push({ key, getter: value, lastValue: initial });
            }
            else if (key === 'visible') {
                // Evaluated first, so a hidden element skips everything else
                cheap.unshift({ key, getter: value });
            }
            else {
                cheap.push({ key, getter: value });
            }
            applyProp(el, key, initial);
        }
        else {
            applyProp(el, key, value);
        }
    }

    addChildren(el, props.children);
    applyEventProps(el, props);

    if (cheap.length > 0 || watched.length > 0) {
        setupDynamicRefresh(el, cheap, watched);
    }

    if (typeof props.ref === 'function') {
        (props.ref as RefCallback<Container>)(el);
    }

    return el;
}

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;
