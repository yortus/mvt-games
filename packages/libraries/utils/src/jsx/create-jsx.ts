import { assert } from '../assert';
import { hasNodeRefresh, setNodeRefresh, setNodeUpdate, SKIP_DESCENDANTS, type UpdateMethod } from '../view-tick-api';
import { MVT_ATTRIBUTE_KEYS } from './attributes';
import type { AttributeDefinition, AttributePattern, WriteKind } from './attributes';
import type { JsxTarget } from './jsx-target';
import type { DestroyedCallback, RefCallback, RefreshStep } from './jsx-types';
import { type Binding, createRefreshBuilder } from './refresh-builder';

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
export type ElementTable<N> = Readonly<Record<string, {
    /** Creates the element from the values of its creation attributes. */
    readonly create: (creation: never) => N;
    readonly attributes: Readonly<Record<string, AttributeDefinition<never>>>;
    readonly patterns: Readonly<Record<string, AttributePattern<never>>>;
}>>;

/** Options for {@link createJsx}. */
export interface JsxOptions<N extends object, R = never> {
    /** The renderer's scene graph, as the base needs it. */
    readonly target: JsxTarget<N, R>;
    /** The JSX target's intrinsic elements. */
    readonly elements: ElementTable<N>;
    /**
     * How many elements a shape of bindings needs on one class of element
     * before it takes a copy of the refresh code of its own (see
     * `refresh-builder.ts`). Default 16: before that, and for shapes with
     * fewer, the shared copy is fast enough, and copies are kept for the
     * shapes with many. Tests set 1, so that every shape takes one.
     */
    readonly ownCopyAt?: number;
}

export interface JsxRuntime<N> {
    /** The JSX factory: what `jsx`, `jsxs` and `jsxDEV` are in the JSX target's runtime module. */
    readonly jsx: JsxFactory<N>;
    readonly Fragment: typeof Fragment;
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
 *   element's refresh method (called by `refreshView`) and written every
 *   frame or on change.
 * - Construction is inert: fixed values are applied at once, but no getter
 *   runs until the element's first refresh. Until then a bound property holds
 *   its default. The host refreshes the whole stage before every render, and
 *   `refreshView` also refreshes whatever `<List>` / `<Switch>` build
 *   during it, so nothing is ever shown with defaults.
 * - A `visible` binding is evaluated first, and a hidden element skips its
 *   other bindings and its whole subtree via `SKIP_DESCENDANTS`.
 * - Event attributes are wired before any other attribute is applied, so a
 *   JSX target's `listen` may set a default that an attribute then overrides.
 * - Creation attributes are collected first, and passed to the element
 *   table's `create`.
 * - `onRefresh` adds a per-frame step of the element's own, after its
 *   bindings (and skipped with them while it is hidden). `onUpdate` installs
 *   its update method. `onDestroyed` runs when it is destroyed. At the same
 *   time, the JSX target's `release` frees each resource that `owns` lists.
 *   `ref` runs last, with the element, for intrinsic elements and components
 *   alike.
 *
 * The runtime throws for an attribute that the element table does not
 * define, for a function given to an attribute that accepts only a fixed
 * value, and for a missing required creation attribute.
 *
 * Why there are no cleanup scopes or context providers, as SolidJS has:
 * `design-notes.md`.
 */
export function createJsx<N extends object, R = never>(options: JsxOptions<N, R>): JsxRuntime<N> {
    const { target, elements } = options;
    // Attribute definitions, resolved once each, by definition.
    const resolvedAttributes = new Map<object, ResolvedAttribute>();
    // Each element's attributes, by tag then key, resolved on first use.
    const resolvedElements = new Map<string, ResolvedElement<N>>();
    const visible = resolveAttribute(target.visible) as ResolvedChangeable;
    const refreshBuilder = createRefreshBuilder({ ownCopyAt: options.ownCopyAt ?? 16 });

    return { jsx, Fragment };

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
        const el = definition.creationKeys.length === 0
            ? definition.create(NO_CREATION_VALUES)
            : definition.create(collectCreationValues(type, definition, attributes));

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
                if (typeof value === 'function') visibleBinding = bind(visible, value as () => unknown);
                else visible.apply(el, value);
                continue;
            }
            const attribute = definition.attributes.get(key) ?? patternAttribute(definition, key);
            if (attribute === undefined) throw new Error(`<${type}> has no attribute '${key}' in ${target.name}`);
            if (attribute.kind === 'event' || attribute.kind === 'creation') continue;
            if (typeof value !== 'function') {
                attribute.apply(el, value);
            }
            else if (attribute.kind === 'fixed') {
                throw new Error(`<${type}> attribute '${key}' takes a fixed value in ${target.name}, not a function`);
            }
            else if (attribute.kind === 'every-frame') {
                (everyFrame ??= []).push(bind(attribute, value as () => unknown));
            }
            else {
                (onChange ??= []).push(bind(attribute, value as () => unknown));
            }
        }

        appendChildren(el, attributes.children);

        if (visibleBinding !== undefined || everyFrame !== undefined || onChange !== undefined) {
            // `visible` first, then every-frame bindings, then on-change ones
            const bindings: Binding[] = [];
            if (visibleBinding !== undefined) bindings.push(visibleBinding);
            if (everyFrame !== undefined) bindings.push(...everyFrame);
            if (onChange !== undefined) bindings.push(...onChange);
            setNodeRefresh(el, refreshBuilder.build(el, bindings, visibleBinding !== undefined));
        }

        if (typeof attributes.onRefresh === 'function') {
            addRefreshStep(el, attributes.onRefresh as RefreshStep<N>);
        }
        if (typeof attributes.onUpdate === 'function') {
            setNodeUpdate(el, attributes.onUpdate as UpdateMethod);
        }
        if (typeof attributes.onDestroyed === 'function') {
            target.onDestroyed(el, attributes.onDestroyed as DestroyedCallback<N>);
        }
        if (attributes.owns !== undefined) own(type, el, attributes.owns);
        callRef(attributes.ref, el);

        return el;
    }

    /** Releases each of `owned` when `el` is destroyed. */
    function own(type: string, el: N, owned: unknown): void {
        if (!Array.isArray(owned)) throw new Error(`<${type}> attribute 'owns' takes an array of resources in ${target.name}`);
        if (owned.length === 0) return;
        // Copied, so that a later change to the view's list doesn't change what's released
        const resources = owned.slice() as R[];
        target.onDestroyed(el, () => {
            for (let i = 0; i < resources.length; i++) target.release(resources[i]);
        });
    }

    /** Collects the values of an element's creation attributes for its `create`, and checks them. */
    function collectCreationValues(type: string, element: ResolvedElement<N>, attributes: Record<string, unknown>): Record<string, unknown> {
        const values: Record<string, unknown> = {};
        for (let i = 0; i < element.creationKeys.length; i++) {
            const key = element.creationKeys[i];
            const value = attributes[key];
            if (typeof value === 'function') {
                throw new Error(`<${type}> attribute '${key}' takes a fixed value, not a function, in ${target.name}, since it's read only once, as the element is made`);
            }
            if (value !== undefined) values[key] = value;
            else if ((element.attributes.get(key) as ResolvedCreation).required) {
                throw new Error(`<${type}> needs its '${key}' attribute in ${target.name}`);
            }
        }
        return values;
    }

    function elementFor(kind: string): ResolvedElement<N> {
        let resolved = resolvedElements.get(kind);
        if (resolved !== undefined) return resolved;
        const definition = Object.hasOwn(elements, kind) ? elements[kind] : undefined;
        assert(definition !== undefined, () => `Unknown ${target.name} element: <${kind}>`);
        const attributes = new Map<string, ResolvedAttribute>();
        const creationKeys: string[] = [];
        for (const key in definition.attributes) {
            const attribute = resolveAttribute(definition.attributes[key]);
            attributes.set(key, attribute);
            if (attribute.kind === 'creation') creationKeys.push(key);
        }
        resolved = {
            create: definition.create as (creation: Readonly<Record<string, unknown>>) => N,
            attributes,
            patterns: definition.patterns,
            creationKeys,
        };
        resolvedElements.set(kind, resolved);
        return resolved;
    }

    /**
     * The attribute a pattern of the element makes for `key`, kept for the
     * element's next use of it. Patterns make no events, which are wired
     * before other attributes are looked up.
     */
    function patternAttribute(element: ResolvedElement<N>, key: string): ResolvedAttribute | undefined {
        for (const prefix in element.patterns) {
            if (key.length <= prefix.length || !key.startsWith(prefix)) continue;
            const resolved = resolveAttribute(element.patterns[prefix](key));
            element.attributes.set(key, resolved);
            return resolved;
        }
        return undefined;
    }

    function resolveAttribute(definition: AttributeDefinition<never>): ResolvedAttribute {
        let resolved = resolvedAttributes.get(definition);
        if (resolved !== undefined) return resolved;
        if (definition.kind === 'event') {
            resolved = { kind: 'event', eventName: definition.eventName };
        }
        else if (definition.kind === 'creation') {
            resolved = { kind: 'creation', required: definition.required };
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
    readonly create: (creation: Readonly<Record<string, unknown>>) => N;
    /** By key: the element's own, then those its patterns have made. */
    readonly attributes: Map<string, ResolvedAttribute>;
    readonly patterns: Readonly<Record<string, AttributePattern<never>>>;
    /** The keys of the element's creation attributes, whose values are collected before it is made. */
    readonly creationKeys: readonly string[];
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

interface ResolvedCreation {
    readonly kind: 'creation';
    readonly required: boolean;
}

type ResolvedAttribute = ResolvedFixed | ResolvedChangeable | ResolvedEvent | ResolvedCreation;

/** The values that `create` receives for an element without creation attributes. */
const NO_CREATION_VALUES: Readonly<Record<string, unknown>> = Object.freeze({});

function bind(attribute: ResolvedChangeable, getter: () => unknown): Binding {
    return { id: attribute.id, kind: attribute.kind, property: attribute.property, apply: attribute.apply, getter };
}

function callRef(ref: unknown, node: unknown): void {
    if (typeof ref === 'function') (ref as RefCallback<unknown>)(node);
}

/**
 * Add an `onRefresh` attribute's step to an element. With bindings as well,
 * the step runs after them, unless a `visible` binding has just hidden the
 * element.
 */
function addRefreshStep<N extends object>(el: N, step: RefreshStep<N>): void {
    // Wraps the bindings' refresh method when there is one; otherwise the step
    // is the element's whole refresh, with nothing to call first.
    if (!hasNodeRefresh(el)) setNodeRefresh(el, () => step(el));
    else setNodeRefresh(el, (own) => (own?.() === SKIP_DESCENDANTS ? SKIP_DESCENDANTS : step(el)));
}
