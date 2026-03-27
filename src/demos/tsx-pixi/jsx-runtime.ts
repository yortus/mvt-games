/**
 * Custom JSX runtime that targets Pixi.js scene-graph construction.
 *
 * - Renders once (no diffing/reconciliation).
 * - Function-valued props become dynamic bindings polled each frame via
 *   Pixi's `onRender` callback, with simple equality change-detection.
 * - The `<list>` element manages a dynamic set of children driven by a
 *   getter that returns the current array of items.
 */

import { Container, type FederatedPointerEvent, Graphics, Sprite, Text, type Texture } from 'pixi.js';

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
 * Build a codegen'd refresh function specialized for the exact set of
 * bindings. The returned function applies all cheap bindings unconditionally
 * and watched bindings only on change - with zero loops or switch dispatch
 * at runtime.
 *
 * Safe: prop keys originate from JSX intrinsic element type definitions,
 * not from user input.
 */
function buildRefreshFn(
    cheap: DynamicBinding[],
    watched: WatchedBinding[],
): (el: Container) => void {
    const getters: (() => unknown)[] = [];
    const lastValues: unknown[] = [];
    const lines: string[] = [];
    let gi = 0;

    for (let i = 0; i < cheap.length; i++) {
        lines.push(propAssign(cheap[i].key, `g[${gi}]()`) + ';');
        getters.push(cheap[i].getter);
        gi++;
    }

    for (let i = 0; i < watched.length; i++) {
        lines.push(
            `var _${i}=g[${gi}]();`,
            `if(_${i}!==v[${i}]){v[${i}]=_${i};${propAssign(watched[i].key, `_${i}`)}}`,
        );
        getters.push(watched[i].getter);
        lastValues.push(watched[i].lastValue);
        gi++;
    }

    // Safe: prop keys originate from JSX intrinsic element type definitions.
    const fn = new Function('e', 'g', 'v', lines.join('\n')) as
        (e: Container, g: (() => unknown)[], v: unknown[]) => void;

    return (el: Container) => fn(el, getters, lastValues);
}

/** Wire up a codegen'd per-frame refresh for dynamic bindings on an element. */
function setupDynamicRefresh(
    el: Container,
    cheap: DynamicBinding[],
    watched: WatchedBinding[],
): void {
    const refresh = buildRefreshFn(cheap, watched);
    el.onRender = () => refresh(el);
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
