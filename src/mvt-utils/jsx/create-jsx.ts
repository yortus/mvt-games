import { type SceneNode, type RefreshMethod, SKIP_DESCENDANTS, type UpdateMethod } from '..';
import { type AttributeDefinition, type ElementDefinition, MVT_ATTRIBUTE_KEYS, type WriteKind } from './attributes';
import type { JsxTarget } from './jsx-target';
import type { DestroyedCallback, RefCallback, RefreshStep } from './jsx-types';
import {
    type Binding, createRefreshBuilder, type RefreshMethodCounts,
} from './refresh-builder';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The JSX fragment marker, shared by every JSX target. */
export const Fragment = Symbol.for('mvt-jsx.fragment');

/** A function component: called with its attributes, it returns a node. */
export type JsxComponent<N> = (attributes: Record<string, unknown>) => N;

/** The JSX factory for a JSX target whose nodes are `N`. */
export type JsxFactory<N> = (type: string | typeof Fragment | JsxComponent<N>, attributes: Record<string, unknown>) => N;

/** A JSX target's element table: each intrinsic element's definition, by tag. */
export type ElementTable<N> = Readonly<Record<string, ElementDefinition<N, Readonly<Record<string, AttributeDefinition<never>>>>>>;

/** Options for {@link createJsx}. */
export interface JsxOptions<N extends SceneNode> {
    /** The renderer's scene graph, as the base needs it. */
    readonly target: JsxTarget<N>;
    /** The JSX target's intrinsic elements. */
    readonly elements: ElementTable<N>;
    /**
     * Whether refresh methods may be generated with `new Function`. By
     * default, whether the page allows it. False leaves only precompiled
     * factories and the slower closure fallback, which is for pages that
     * forbid `new Function` and for testing that the paths behave the same.
     */
    readonly canGenerateCode?: boolean;
}

export interface JsxRuntime<N> {
    /** The JSX factory: what `jsx`, `jsxs` and `jsxDEV` are in the JSX target's runtime module. */
    readonly jsx: JsxFactory<N>;
    readonly Fragment: typeof Fragment;
    /** How many refresh methods this runtime has made from precompiled, generated and fallback code. */
    readonly refreshMethodCounts: RefreshMethodCounts;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The JSX runtime for a JSX target: renders once, with no diffing or
 * reconciliation.
 *
 * - An attribute is written as its definition in the element table says. A
 *   function given to a changeable attribute is a binding, polled from the
 *   element's `onRefresh` method (called by the renderer's `refreshScene`) and written
 *   every frame or on change.
 * - Construction is inert: fixed values are applied at once, but no getter
 *   runs until the element's first refresh. Until then a bound property holds
 *   its default. The ticker refreshes the whole scene before every render, and
 *   `<List>` / `<Switch>` refresh whatever they build during a scene pass, so nothing is
 *   ever shown with defaults.
 * - A `visible` binding is evaluated first, and a hidden element skips its
 *   other bindings and its whole subtree via `SKIP_DESCENDANTS`.
 * - Event attributes are wired before any other attribute is applied, so a
 *   JSX target's `listen` may set a default that an attribute then overrides.
 * - `onRefresh` adds a per-frame step of the element's own, after its
 *   bindings (and skipped with them while it is hidden). `onUpdate` installs
 *   its update method. `onDestroyed` runs when it is destroyed. `ref` runs
 *   last, with the element, for intrinsic elements and components alike.
 *
 * An attribute the element table does not define, and a function given to an
 * attribute that takes only a fixed value, throw.
 *
 * Why there are no cleanup scopes or context providers, as SolidJS has:
 * `design-notes.md`.
 */
export function createJsx<N extends SceneNode>(options: JsxOptions<N>): JsxRuntime<N> {
    const { target, elements } = options;
    // Attribute definitions, resolved once each, by definition.
    const resolvedAttributes = new Map<object, ResolvedAttribute>();
    // Each element's attributes, by tag then key, resolved on first use.
    const resolvedElements = new Map<string, ResolvedElement<N>>();
    const visible = resolveAttribute(target.visible) as ResolvedChangeable;
    // Probes `new Function` only when a factory must be generated, so a page
    // whose shapes are all precompiled never tries it.
    const refreshBuilder = createRefreshBuilder({ name: target.name, canGenerateCode: options.canGenerateCode });

    return {
        jsx,
        Fragment,
        refreshMethodCounts: refreshBuilder.counts,
    };

    function jsx(type: string | typeof Fragment | JsxComponent<N>, attributes: Record<string, unknown>): N {
        // Component functions. The runtime calls `ref` on whatever the component
        // returns, so components must never consume `ref` themselves.
        if (typeof type === 'function') {
            const node = type(attributes);
            callRef(attributes.ref, node);
            return node;
        }

        if (type === Fragment) {
            const group = target.createGroup();
            appendChildren(group, attributes.children);
            return group;
        }

        const definition = elementFor(type);
        const el = definition.create();

        // Events first, so an attribute applied below can override a default
        // that the JSX target's `listen` sets (Pixi's `eventMode`).
        for (const key in attributes) {
            const attribute = definition.attributes.get(key);
            if (attribute?.kind !== 'event') continue;
            const handler = attributes[key];
            if (typeof handler === 'function') target.listen(el, attribute.eventName, handler as (event: never) => void);
        }

        // Every other attribute, in source order. Bindings are recorded but not
        // evaluated: construction is inert, and their first evaluation is the
        // element's first refresh, which runs only once the whole tree exists,
        // so an ancestor that hides or skips this element (a `visible`
        // binding, an empty `<List>` slot, an unselected branch) can keep a
        // binding that is not yet valid from ever running.
        let visibleBinding: Binding | undefined;
        let everyFrame: Binding[] | undefined;
        let onChange: Binding[] | undefined;
        for (const key in attributes) {
            const value = attributes[key];
            if (MVT_ATTRIBUTE_KEYS.has(key)) {
                if (key !== 'visible') continue;
                if (typeof value === 'function') visibleBinding = bind('visible', visible, value as () => unknown);
                else visible.apply(el, value);
                continue;
            }
            const attribute = definition.attributes.get(key);
            if (attribute === undefined) throw new Error(`<${type}> has no attribute '${key}' in ${target.name}`);
            if (attribute.kind === 'event') continue;
            if (typeof value !== 'function') {
                attribute.apply(el, value);
            }
            else if (attribute.kind === 'fixed') {
                throw new Error(`<${type}> attribute '${key}' takes a fixed value in ${target.name}, not a function`);
            }
            else if (attribute.kind === 'every-frame') {
                (everyFrame ??= []).push(bind(key, attribute, value as () => unknown));
            }
            else {
                (onChange ??= []).push(bind(key, attribute, value as () => unknown));
            }
        }

        appendChildren(el, attributes.children);

        if (visibleBinding !== undefined || everyFrame !== undefined || onChange !== undefined) {
            // `visible` first, then every-frame bindings, then on-change ones
            const bindings: Binding[] = [];
            if (visibleBinding !== undefined) bindings.push(visibleBinding);
            if (everyFrame !== undefined) bindings.push(...everyFrame);
            if (onChange !== undefined) bindings.push(...onChange);
            el.onRefresh = refreshBuilder.build(el, bindings, visibleBinding !== undefined);
        }

        if (typeof attributes.onRefresh === 'function') {
            addRefreshStep(el, attributes.onRefresh as RefreshStep<N>);
        }
        if (typeof attributes.onUpdate === 'function') {
            el.onUpdate = attributes.onUpdate as UpdateMethod;
        }
        if (typeof attributes.onDestroyed === 'function') {
            target.onDestroyed(el, attributes.onDestroyed as DestroyedCallback<N>);
        }
        callRef(attributes.ref, el);

        return el;
    }

    function elementFor(kind: string): ResolvedElement<N> {
        let resolved = resolvedElements.get(kind);
        if (resolved !== undefined) return resolved;
        const definition = Object.hasOwn(elements, kind) ? elements[kind] : undefined;
        if (definition === undefined) throw new Error(`Unknown ${target.name} element: <${kind}>`);
        const attributes = new Map<string, ResolvedAttribute>();
        for (const key in definition.attributes) {
            attributes.set(key, resolveAttribute(definition.attributes[key]));
        }
        resolved = { create: definition.create, attributes };
        resolvedElements.set(kind, resolved);
        return resolved;
    }

    function resolveAttribute(definition: AttributeDefinition<never>): ResolvedAttribute {
        let resolved = resolvedAttributes.get(definition);
        if (resolved !== undefined) return resolved;
        if (definition.kind === 'event') {
            resolved = { kind: 'event', eventName: definition.eventName };
        }
        else {
            const apply = definition.apply as (el: unknown, value: unknown) => void;
            resolved = definition.kind === 'fixed'
                ? { kind: 'fixed', apply }
                : { id: resolvedAttributes.size, kind: definition.kind, apply, property: definition.property };
        }
        resolvedAttributes.set(definition, resolved);
        return resolved;
    }

    function appendChildren(parent: N, children: unknown): void {
        if (children == null) return;
        if (Array.isArray(children)) {
            for (let i = 0; i < children.length; i++) appendChildren(parent, children[i]);
        }
        else {
            target.append(parent, children as N);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ResolvedElement<N> {
    readonly create: () => N;
    readonly attributes: ReadonlyMap<string, ResolvedAttribute>;
}

interface ResolvedFixed {
    readonly kind: 'fixed';
    readonly apply: (el: unknown, value: unknown) => void;
}

interface ResolvedChangeable {
    /** Unique within one runtime: the refresh builder's fast cache key. */
    readonly id: number;
    readonly kind: WriteKind;
    readonly apply: (el: unknown, value: unknown) => void;
    readonly property: string | undefined;
}

interface ResolvedEvent {
    readonly kind: 'event';
    readonly eventName: string;
}

type ResolvedAttribute = ResolvedFixed | ResolvedChangeable | ResolvedEvent;

function bind(key: string, attribute: ResolvedChangeable, getter: () => unknown): Binding {
    return { id: attribute.id, key, kind: attribute.kind, property: attribute.property, apply: attribute.apply, getter };
}

function callRef(ref: unknown, node: unknown): void {
    if (typeof ref === 'function') (ref as RefCallback<unknown>)(node);
}

/**
 * Add an `onRefresh` attribute's step to an element. With bindings as well,
 * the step runs after them, unless a `visible` binding has just hidden the
 * element.
 */
function addRefreshStep<N extends SceneNode>(el: N, step: RefreshStep<N>): void {
    const ownRefresh: RefreshMethod | undefined = el.onRefresh;
    el.onRefresh = ownRefresh === undefined
        ? () => step(el)
        : () => (ownRefresh() === SKIP_DESCENDANTS ? SKIP_DESCENDANTS : step(el));
}
