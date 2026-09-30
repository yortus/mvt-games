import { readCounter, type RefreshMethod, SKIP_DESCENDANTS } from '..';
import { REFRESH_SOURCE_VERSION, refreshFactorySource, refreshShapeKey, type ShapeBinding } from './refresh-source';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A changeable attribute bound to a getter on one element. */
export interface Binding extends ShapeBinding {
    /** The attribute definition's id, unique within one runtime: the fast cache's key. */
    readonly id: number;
    readonly apply: (el: unknown, value: unknown) => void;
    readonly getter: () => unknown;
}

/**
 * A refresh factory: called once per element with the element, the skip
 * sentinel, the `UNSET` marker, the read counter, then each binding's getter
 * and apply function as separate arguments, it returns that element's refresh
 * method. Its source is `refreshFactorySource`'s.
 */
export type RefreshFactory = (...args: unknown[]) => RefreshMethod;

/** How many refresh methods a runtime has made each way. For diagnostics and tests. */
export interface RefreshMethodCounts {
    /** From a factory the build-time precompiler registered. */
    readonly precompiled: number;
    /** From a factory generated at run time with `new Function`. */
    readonly generated: number;
    /** From the closure fallback, where neither was available. */
    readonly fallback: number;
}

/** Makes the refresh method for one element's bindings. */
export interface RefreshBuilder {
    /**
     * `bindings` are in the order to write them. When `hasVisible` is true,
     * the first is the `visible` binding: evaluated first, and when false the
     * element's other bindings and its subtree are skipped.
     */
    build: (el: unknown, bindings: readonly Binding[], hasVisible: boolean) => RefreshMethod;
    readonly counts: RefreshMethodCounts;
}

/** Options for {@link createRefreshBuilder}. */
export interface RefreshBuilderOptions {
    /** Names the runtime in dev warnings. */
    readonly name: string;
    /**
     * Whether refresh factories may be generated with `new Function`. By
     * default, whether the page allows it ({@link canGenerateCode}).
     */
    readonly canGenerateCode?: boolean;
}

/**
 * Adds refresh factories made at build time, by `refreshShapeKey`, for every
 * runtime on the page: generated code depends only on a binding shape, never
 * on the JSX target. A shape found here needs no `new Function`, so a page whose
 * Content Security Policy forbids it still gets generated code. `version` is
 * the `REFRESH_SOURCE_VERSION` they were made with; factories of any other
 * version are ignored, with a warning in dev builds.
 *
 * The precompiler's one way into the runtime. The code it adds to a module
 * imports this from `<importSource>/jsx-runtime`, which the app can always
 * resolve, so each renderer's `jsx-runtime` re-exports it. Unused, it costs a
 * map lookup the first time each binding shape is built.
 */
export function registerRefreshFactories(factories: Readonly<Record<string, RefreshFactory>>, version: number): void {
    if (version !== REFRESH_SOURCE_VERSION) {
        if (DEV && !hasReportedVersion) {
            hasReportedVersion = true;
            console.warn(
                `[mvt-utils/jsx] Ignoring refresh factories precompiled for version ${version} of the refresh source; `
                + `this runtime is version ${REFRESH_SOURCE_VERSION}. The precompiler and the runtime come from `
                + 'different releases: install matching versions.',
            );
        }
        return;
    }
    for (const key in factories) {
        if (!precompiledFactories.has(key)) precompiledFactories.set(key, factories[key]);
    }
    registrations++;
}

/**
 * Whether this page lets the runtime generate code with `new Function`.
 * Tried once, the first time a refresh factory must be generated. A page
 * whose Content Security Policy forbids it gets the closure fallback, and in
 * dev builds, one warning. Building with `__MVT_JSX_EVAL__` defined as
 * `false` skips the attempt and the warning.
 */
export function canGenerateCode(): boolean {
    if (isCodeGenerationAllowed === undefined) isCodeGenerationAllowed = probeCodeGeneration();
    return isCodeGenerationAllowed;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A builder of refresh methods. Each distinct binding shape gets a refresh
 * factory: one registered by the precompiler if there is one, else one
 * generated with `new Function` and cached, if the page allows it
 * (`options.canGenerateCode`, or by default, if {@link canGenerateCode}). Where
 * neither is available, the element gets the closure fallback.
 *
 * Generated code is faster. Measured by the `jsx-refresh` benchmark suite on
 * Pixi, per frame at 1,000 and 10,000 elements, the fallback is 1.4x to 2.6x
 * slower (task 025): V8 inlines each generated method's getters and writes,
 * but none of the fallback's, whose call sites are shared by every element
 * with the same number of bindings.
 */
export function createRefreshBuilder(options: RefreshBuilderOptions): RefreshBuilder {
    const name = options.name;
    const isGenerationAllowed = options.canGenerateCode;
    // Factories generated on first use, by shape key (`refreshShapeKey`).
    // Bounded by the number of distinct binding shapes in source, so never
    // evicted. Precompiled ones are shared by every runtime (module level).
    const generated = new Map<string, RefreshFactory>();
    // The fast path: what each sequence of attribute definitions resolved to,
    // keyed by their ids. Building the thousandth element with a given shape
    // costs one short key and one lookup here, not a shape key and a lookup
    // in each map: measured, the shape key alone made building a JSX element
    // 40% slower. Cleared when a registration arrives, so that a shape
    // resolved before a later module registered it picks up its factory.
    const resolved = new Map<string, ResolvedFactory>();
    let registrationsSeen = registrations;
    // Shapes already reported as missing from the precompiled ones.
    const reportedMisses = new Set<string>();
    const counts = { precompiled: 0, generated: 0, fallback: 0 };

    return { build, counts };

    function build(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshMethod {
        if (registrationsSeen !== registrations) {
            registrationsSeen = registrations;
            resolved.clear();
        }
        let idKey = hasVisible ? 'v' : '';
        for (let i = 0; i < bindings.length; i++) idKey += bindings[i].id + ',';
        let entry = resolved.get(idKey);
        if (entry === undefined) {
            entry = resolve(bindings, hasVisible);
            resolved.set(idKey, entry);
        }

        const factory = entry.factory;
        if (factory === undefined) {
            counts.fallback++;
            return buildFallback(el, bindings, hasVisible);
        }
        if (entry.isPrecompiled) counts.precompiled++;
        else counts.generated++;

        // Construction only, so building this argument list is off the hot path.
        const args: unknown[] = [el, SKIP_DESCENDANTS, UNSET, readCounter];
        for (let i = 0; i < bindings.length; i++) args.push(bindings[i].getter, bindings[i].apply);
        return factory(...args);
    }

    /** The factory for a shape: registered, else generated if allowed, else none (the fallback). */
    function resolve(bindings: readonly Binding[], hasVisible: boolean): ResolvedFactory {
        const key = refreshShapeKey(hasVisible, bindings);
        const precompiled = precompiledFactories.get(key);
        if (precompiled !== undefined) return { factory: precompiled, isPrecompiled: true };
        let factory = generated.get(key);
        if (factory === undefined) {
            if (!(isGenerationAllowed ?? canGenerateCode())) {
                reportMiss(key);
                return { factory: undefined, isPrecompiled: false };
            }
            const source = refreshFactorySource(hasVisible, bindings);
            factory = new Function(...source.params, source.body) as RefreshFactory;
            generated.set(key, factory);
        }
        return { factory, isPrecompiled: false };
    }

    /**
     * In dev builds, when the page uses the precompiler but a shape was not
     * precompiled and cannot be generated, says which, once per shape: the
     * precompiler sees only intrinsic elements written in `.tsx` files, and
     * guesses no further than the syntax allows.
     */
    function reportMiss(key: string): void {
        if (!DEV || precompiledFactories.size === 0 || reportedMisses.has(key)) return;
        reportedMisses.add(key);
        console.warn(`[mvt-utils/jsx] ${name}: no precompiled refresh for binding shape '${key}', so it uses the slower fallback.`);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Factories the precompiler made, by shape key, for every runtime on the page. */
const precompiledFactories = new Map<string, RefreshFactory>();

/** How many registrations there have been, so each builder knows when to drop its fast cache. */
let registrations = 0;

let hasReportedVersion = false;

/** What a sequence of attribute definitions resolved to. No factory means the fallback. */
interface ResolvedFactory {
    readonly factory: RefreshFactory | undefined;
    readonly isPrecompiled: boolean;
}

/**
 * The "last value" of an on-change binding before its first refresh. Unequal
 * to anything a getter can return, so the first refresh always writes.
 * Bindings are never evaluated at construction, so there is no real initial
 * value to seed with.
 */
const UNSET: unique symbol = Symbol('mvt-jsx.unset');

// Vite replaces `import.meta.env.DEV` at build time. Plain Node - which is how
// the benchmark harness runs - has no `import.meta.env` at all, so it is read
// defensively here rather than assumed.
const DEV = import.meta.env?.DEV === true;

// A build-time constant an application may define (with Vite's `define`) as
// `false` when it knows its pages forbid `new Function`. Usually undefined.
declare const __MVT_JSX_EVAL__: boolean | undefined;

let isCodeGenerationAllowed: boolean | undefined;

function probeCodeGeneration(): boolean {
    if (typeof __MVT_JSX_EVAL__ !== 'undefined' && __MVT_JSX_EVAL__ === false) return false;
    try {
        new Function('')();
        return true;
    }
    catch {
        if (DEV) {
            console.warn(
                '[mvt-utils/jsx] This page\'s Content Security Policy blocks new Function, so JSX bindings that were not '
                + 'precompiled are refreshed by a slower fallback (1.4-2.6x slower per bound element on Pixi, measured). '
                + 'Precompile them with the Vite plugin, add \'unsafe-eval\' to script-src, or define '
                + '__MVT_JSX_EVAL__ as false to skip this check and this warning.',
            );
        }
        return false;
    }
}

/**
 * The fallback, for pages that forbid `new Function`: closures only, the same
 * writes and the same read counts as the generated methods. Measured by the
 * `jsx-refresh` suite on Pixi, 1.4x to 2.6x slower than generated code
 * (task 025). Two things keep it close:
 *
 * - **Each binding's writer.** An attribute defined by a property is written
 *   through the property's setter, found once on the element's prototype
 *   chain ({@link setterOf}) and called directly. Assigning `el[name] = value`
 *   instead, one keyed store for every property of every element, made the
 *   first fallback 6-16x slower than generated code: V8 handles it slowly
 *   when it reaches an accessor, as Pixi's `x` is.
 * - **A call site per position.** The refresh methods for up to six bindings
 *   are written out ({@link writeFrom}), so each binding's getter and writer
 *   are called from their own call sites, rather than all from one in a loop.
 */
function buildFallback(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshMethod {
    const count = bindings.length;
    let numberCount = 0;
    for (let i = 0; i < count; i++) {
        if (bindings[i].kind === 'on-change-number') numberCount++;
    }
    const lastNumbers = new Float64Array(numberCount).fill(NaN);
    const getters: (() => unknown)[] = [];
    const writers: Writer[] = [];
    let numberIndex = 0;
    for (let i = 0; i < count; i++) {
        const binding = bindings[i];
        getters.push(binding.getter);
        writers.push(writerOf(el, binding, lastNumbers, binding.kind === 'on-change-number' ? numberIndex++ : -1));
    }
    if (!hasVisible) return writeFrom(el, getters, writers, 0, count);

    // `visible` first: when false, nothing else is read, and one read is counted
    const isVisible = getters[0];
    const writeVisible = writers[0];
    const writeRest = writeFrom(el, getters, writers, 1, 0);
    const restReads = count - 1;
    return () => {
        if (readCounter.isCounting) readCounter.count++;
        const value = isVisible();
        writeVisible.call(el, value);
        if (!value) return SKIP_DESCENDANTS;
        if (readCounter.isCounting) readCounter.count += restReads;
        writeRest();
    };
}

/**
 * Writes one binding's value to the element it was made for. Called as
 * `writer.call(el, value)`, so that a property's setter can be the writer
 * itself; any other writer ignores the receiver, and closes over the element.
 */
type Writer = (value: unknown) => void;

/**
 * The writer for one binding on `el`, as its kind says: every frame, or on
 * change, keeping the last value in a closure, or for a number, in
 * `lastNumbers[numberIndex]`, unboxed, as generated code keeps it.
 */
function writerOf(el: unknown, binding: Binding, lastNumbers: Float64Array, numberIndex: number): Writer {
    const apply = binding.apply;
    const setter = binding.property === undefined ? undefined : setterOf(el, binding.property);
    const write: Writer = setter ?? ((value) => apply(el, value));
    if (binding.kind === 'every-frame') return write;
    if (binding.kind === 'on-change') {
        let last: unknown = UNSET;
        return (value) => {
            if (value !== last) {
                last = value;
                write.call(el, value);
            }
        };
    }
    return (value) => {
        if (value !== lastNumbers[numberIndex]) {
            lastNumbers[numberIndex] = value as number;
            write.call(el, value);
        }
    };
}

/**
 * The setter that assigning `el[property]` would call, found once per
 * prototype and property: the first definition of `property` on the
 * prototype chain, if it is an accessor with a setter. `undefined` for a
 * data property, one defined on the element itself, or a getter alone; those
 * are assigned through the attribute's `apply`, as before.
 */
function setterOf(el: unknown, property: string): Writer | undefined {
    const prototype: unknown = Object.getPrototypeOf(el);
    if (typeof prototype !== 'object' || prototype === null || Object.hasOwn(el as object, property)) return undefined;
    let setters = settersByPrototype.get(prototype);
    if (setters === undefined) {
        setters = new Map();
        settersByPrototype.set(prototype, setters);
    }
    if (!setters.has(property)) setters.set(property, findSetter(prototype, property));
    return setters.get(property);
}

/** Setters found by {@link setterOf}, by prototype, then property; `undefined` where there is none. */
const settersByPrototype = new WeakMap<object, Map<string, Writer | undefined>>();

function findSetter(prototype: object, property: string): Writer | undefined {
    for (let o: object | null = prototype; o !== null; o = Object.getPrototypeOf(o) as object | null) {
        const descriptor = Object.getOwnPropertyDescriptor(o, property);
        if (descriptor !== undefined) return descriptor.set as Writer | undefined;
    }
    return undefined;
}

/**
 * A method that reads and writes bindings `first` onward, counting `reads`
 * reads. Written out for up to six bindings, so each has its own call sites;
 * a loop beyond that.
 */
function writeFrom(el: unknown, getters: readonly (() => unknown)[], writers: readonly Writer[], first: number, reads: number): () => undefined {
    const g0 = getters[first], g1 = getters[first + 1], g2 = getters[first + 2];
    const g3 = getters[first + 3], g4 = getters[first + 4], g5 = getters[first + 5];
    const w0 = writers[first], w1 = writers[first + 1], w2 = writers[first + 2];
    const w3 = writers[first + 3], w4 = writers[first + 4], w5 = writers[first + 5];
    const c = readCounter;
    switch (getters.length - first) {
        case 0: return () => undefined;
        case 1: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
        };
        case 2: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
            w1.call(el, g1());
        };
        case 3: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
            w1.call(el, g1());
            w2.call(el, g2());
        };
        case 4: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
            w1.call(el, g1());
            w2.call(el, g2());
            w3.call(el, g3());
        };
        case 5: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
            w1.call(el, g1());
            w2.call(el, g2());
            w3.call(el, g3());
            w4.call(el, g4());
        };
        case 6: return () => {
            if (c.isCounting) c.count += reads;
            w0.call(el, g0());
            w1.call(el, g1());
            w2.call(el, g2());
            w3.call(el, g3());
            w4.call(el, g4());
            w5.call(el, g5());
        };
        default: {
            const count = getters.length;
            return () => {
                if (c.isCounting) c.count += reads;
                for (let i = first; i < count; i++) writers[i].call(el, getters[i]());
            };
        }
    }
}
