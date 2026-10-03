import { type RefreshMethod, SKIP_DESCENDANTS, tickCounter } from '../tick-api';
import type { WriteKind } from './attributes';
import { REFRESH_COPIES, type RefreshCopy, type Write, type Writer } from './refresh-copies';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A changeable attribute bound to a getter on one element. */
export interface Binding {
    /** The attribute definition's id, unique within one runtime: part of a shape's key. */
    readonly id: number;
    readonly kind: WriteKind;
    /** The property the attribute assigns, or `undefined` for one written by its apply function. */
    readonly property: string | undefined;
    readonly apply: (el: unknown, value: unknown) => void;
    readonly getter: () => unknown;
}

/** Options for {@link createRefreshBuilder}. */
export interface RefreshBuilderOptions {
    /** How many elements a shape needs on one class to take a copy of the refresh code of its own. */
    readonly ownCopyAt: number;
}

/** Makes the refresh method for one element's bindings. */
export interface RefreshBuilder {
    /**
     * `bindings` are in the order to write them. When `hasVisible` is true,
     * the first is the `visible` binding: evaluated first, and when false the
     * element's other bindings and its subtree are skipped.
     */
    build: (el: unknown, bindings: readonly Binding[], hasVisible: boolean) => RefreshMethod;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A builder of refresh methods, with no generated code, so that it runs
 * wherever the page's Content Security Policy forbids `new Function`. Each
 * method writes every-frame bindings every frame and on-change bindings only
 * on change, and counts its reads. What keeps it fast:
 *
 * - **A copy of the code per shape.** V8 keeps its feedback per function in
 *   source, so the refresh code for each number of bindings, 1 to 6, is
 *   written out many times, in `refresh-copies.ts`, which
 *   `scripts/generate-refresh-copies.ts` generates. A shape (its sequence of attribute
 *   definitions) with many elements on one class of element takes a copy of
 *   its own ({@link takeCopy}), whose call sites see only its getters and
 *   writes, and V8 inlines them. Its property writes are `el[name] = value`:
 *   a store that sees one name and one class, which V8 makes as fast as
 *   `el.x = value`. Seeing many classes, the same store is several times
 *   slower than calling the setter, so it is only made in a copy of one
 *   shape and class of its own.
 * - **A shared copy for the rest**: shapes with few elements, those beyond
 *   the copies, and every shape until it has its own. It writes a property
 *   through its setter, found once per prototype ({@link setterOf}), which is
 *   safe on any number of classes, if not inlined.
 * - **Little memory per element**, which dominates in scenes of thousands:
 *   one slot per binding for how it is written, an on-change binding's last
 *   value kept in the copy, and a typed array only for number bindings.
 *
 * Measured on Pixi by the `jsx-refresh` and `falling-sand-scaling` suites,
 * from 1,000 to 200,000 elements, this is 1.1x to 1.3x slower than code
 * generated per shape with `new Function`, where each shape is on one class
 * of element, and faster where one shape is on many. The runtime used to
 * generate such code, with a build-time precompiler for pages that forbid
 * `new Function`; both were removed for this (the last commit with them is
 * tagged `jsx-precompiler-last`).
 */
export function createRefreshBuilder(options: RefreshBuilderOptions): RefreshBuilder {
    const ownCopyAt = options.ownCopyAt;
    // Each shape on each class of element, by the ids of its attribute
    // definitions and its class. Bounded by the shapes in source.
    const shapes = new Map<string, Shape>();

    return { build };

    function build(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshMethod {
        const count = bindings.length;
        let numberCount = 0;
        for (let i = 0; i < count; i++) {
            if (bindings[i].kind === 'on-change-number') numberCount++;
        }
        const lastNumbers = numberCount === 0 ? undefined : new Float64Array(numberCount).fill(NaN);
        const own = count < REFRESH_COPIES.length ? ownCopy(el, bindings, hasVisible) : undefined;
        const getters: (() => unknown)[] = [];
        const writes: Write[] = [];
        let changes = 0;
        let numberIndex = 0;
        for (let i = 0; i < count; i++) {
            const binding = bindings[i];
            getters.push(binding.getter);
            if (binding.kind === 'on-change') changes |= 1 << i;
            if (lastNumbers !== undefined && binding.kind === 'on-change-number') {
                writes.push(numberWriter(writerOf(el, binding), lastNumbers, numberIndex++));
            }
            else {
                writes.push(own !== undefined && binding.property !== undefined ? binding.property : writerOf(el, binding));
            }
        }
        if (count >= REFRESH_COPIES.length) return loopRefresh(el, getters, writes as Writer[], bindings, hasVisible);
        const copy = own ?? REFRESH_COPIES[count][0];
        return copy(el as Record<string, unknown>, getters, writes, changes, hasVisible, UNSET);
    }

    /**
     * The copy of the refresh code that elements of this shape and class have
     * of their own, if they have one yet: from their `ownCopyAt`th, while
     * copies last. Keyed by class too, because a copy assigns
     * properties by name, and that store is fast while it sees one class.
     */
    function ownCopy(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshCopy | undefined {
        let key = hasVisible ? 'v' : '';
        for (let i = 0; i < bindings.length; i++) key += `${bindings[i].id},`;
        key += classIdOf(el);
        let shape = shapes.get(key);
        if (shape === undefined) {
            shape = { built: 0, copy: undefined };
            shapes.set(key, shape);
        }
        shape.built++;
        if (shape.copy === undefined && shape.built >= ownCopyAt) shape.copy = takeCopy(bindings.length);
        return shape.copy;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A shape on one class of element, as built so far. */
interface Shape {
    built: number;
    copy: RefreshCopy | undefined;
}

/**
 * The "last value" of an on-change binding before its first refresh. Unequal
 * to anything a getter can return, so the first refresh always writes.
 * Bindings are never evaluated at construction, so there is no real initial
 * value to seed with.
 */
const UNSET: unique symbol = Symbol('mvt-jsx.unset');

/** How many copies of the refresh code shapes have taken, for each number of bindings. */
const copiesTaken: number[] = [];

/** The next copy of the refresh code for `count` bindings not yet taken, if any; copy 0 is the shared one. */
function takeCopy(count: number): RefreshCopy | undefined {
    const copies = REFRESH_COPIES[count];
    const taken = copiesTaken[count] ?? 0;
    if (1 + taken >= copies.length) return undefined;
    copiesTaken[count] = taken + 1;
    return copies[1 + taken];
}

/** Ids for element classes, by constructor, so that a shape's key can include its class. */
const classIds = new WeakMap<object, number>();
let classCount = 0;

function classIdOf(el: unknown): number {
    const constructor: unknown = (el as { constructor?: unknown }).constructor;
    if (typeof constructor !== 'function') return 0;
    let id = classIds.get(constructor);
    if (id === undefined) {
        id = ++classCount;
        classIds.set(constructor, id);
    }
    return id;
}

/**
 * How the shared copy writes one binding: its apply function, or for an
 * attribute defined by a property, the property's setter where there is one.
 */
function writerOf(el: unknown, binding: Binding): Writer {
    if (binding.property === undefined) return binding.apply;
    return setterOf(el, binding.property) ?? binding.apply;
}

/**
 * An on-change number binding's writer: compares with the last value, kept
 * unboxed in `lastNumbers[index]`. A number kept in a closure is boxed on
 * every change, which allocates.
 */
function numberWriter(write: Writer, lastNumbers: Float64Array, index: number): Writer {
    return (el, value) => {
        if (value !== lastNumbers[index]) {
            lastNumbers[index] = value as number;
            write(el, value);
        }
    };
}

/**
 * A writer that calls the setter assigning `el[property]` would call, made
 * once per prototype and property: from the first definition of `property`
 * on the prototype chain, if it is an accessor with a setter. `undefined` for
 * a data property, one defined on the element itself, or a getter alone;
 * those are assigned through the attribute's `apply`.
 */
function setterOf(el: unknown, property: string): Writer | undefined {
    const prototype: unknown = Object.getPrototypeOf(el);
    if (typeof prototype !== 'object' || !prototype || Object.hasOwn(el as object, property)) return undefined;
    let writers = settersByPrototype.get(prototype);
    if (writers === undefined) {
        writers = new Map();
        settersByPrototype.set(prototype, writers);
    }
    if (!writers.has(property)) writers.set(property, findSetter(prototype, property));
    return writers.get(property);
}

/** Writers made by {@link setterOf}, by prototype, then property; `undefined` where there is no setter. */
const settersByPrototype = new WeakMap<object, Map<string, Writer | undefined>>();

function findSetter(prototype: object, property: string): Writer | undefined {
    // The chain ends where `Object.getPrototypeOf` returns null
    for (let o: unknown = prototype; o; o = Object.getPrototypeOf(o)) {
        const descriptor = Object.getOwnPropertyDescriptor(o, property);
        if (descriptor === undefined) continue;
        const setter = descriptor.set as ((value: unknown) => void) | undefined;
        return setter === undefined ? undefined : (el, value) => setter.call(el, value);
    }
    return undefined;
}

/** The refresh method for more bindings than the copies are written for: a loop. */
function loopRefresh(
    el: unknown, getters: readonly (() => unknown)[], writers: readonly Writer[], bindings: readonly Binding[], hasVisible: boolean,
): RefreshMethod {
    const count = getters.length;
    const isOnChange: boolean[] = [];
    const lastValues: unknown[] = [];
    for (let i = 0; i < count; i++) {
        isOnChange.push(bindings[i].kind === 'on-change');
        lastValues.push(UNSET);
    }
    return () => {
        if (tickCounter.isCounting) tickCounter.reads += hasVisible ? 1 : count;
        for (let i = 0; i < count; i++) {
            const value = getters[i]();
            if (!isOnChange[i]) {
                writers[i](el, value);
            }
            else if (value !== lastValues[i]) {
                lastValues[i] = value;
                writers[i](el, value);
            }
            if (i === 0 && hasVisible) {
                if (!value) return SKIP_DESCENDANTS;
                if (tickCounter.isCounting) tickCounter.reads += count - 1;
            }
        }
    };
}
