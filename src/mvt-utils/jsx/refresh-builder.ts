import { readCounter, type RefreshMethod, SKIP_DESCENDANTS } from '..';
import type { WriteKind } from './attributes';
import { refreshFactorySource, refreshShapeKey, type ShapeBinding } from './refresh-source';

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
    /** From a factory generated at run time with `new Function`. */
    readonly generated: number;
    /** From the closure fallback, where `new Function` was not available. */
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
    /**
     * Whether refresh factories may be generated with `new Function`. By
     * default, whether the page allows it ({@link canGenerateCode}).
     */
    readonly canGenerateCode?: boolean;
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
 * factory, generated with `new Function` and cached, if the page allows it
 * (`options.canGenerateCode`, or by default, if {@link canGenerateCode}). Where
 * it does not, the element gets the closure fallback.
 *
 * Generated code is several times faster. Measured by the `jsx-refresh`
 * benchmark suite on Pixi, per frame at 1,000 and 10,000 elements, the
 * fallback is 6x to 16x slower (proposal 022 section 7.5.1). Its call sites
 * see every attribute's functions, so V8 inlines none of them, and an
 * attribute defined by a property is written with a dynamic keyed store
 * (`el[name] = value`), which V8 handles slowly when it hits a setter, as
 * Pixi's `x` does. It is not allocation: garbage collections were the same.
 */
export function createRefreshBuilder(options: RefreshBuilderOptions): RefreshBuilder {
    const isGenerationAllowed = options.canGenerateCode;
    // Factories generated on first use, by shape key (`refreshShapeKey`).
    // Bounded by the number of distinct binding shapes in source, so never
    // evicted.
    const generated = new Map<string, RefreshFactory>();
    // The fast path: what each sequence of attribute definitions resolved to,
    // keyed by their ids. Building the thousandth element with a given shape
    // costs one short key and one lookup here, not a shape key and a lookup
    // in the map: measured, the shape key alone made building a JSX element
    // 40% slower.
    const resolved = new Map<string, ResolvedFactory>();
    const counts = { generated: 0, fallback: 0 };

    return { build, counts };

    function build(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshMethod {
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
        counts.generated++;

        // Construction only, so building this argument list is off the hot path.
        const args: unknown[] = [el, SKIP_DESCENDANTS, UNSET, readCounter];
        for (let i = 0; i < bindings.length; i++) args.push(bindings[i].getter, bindings[i].apply);
        return factory(...args);
    }

    /** The factory for a shape: generated if allowed, else none (the fallback). */
    function resolve(bindings: readonly Binding[], hasVisible: boolean): ResolvedFactory {
        const key = refreshShapeKey(hasVisible, bindings);
        let factory = generated.get(key);
        if (factory === undefined) {
            if (!(isGenerationAllowed ?? canGenerateCode())) return { factory: undefined };
            const source = refreshFactorySource(hasVisible, bindings);
            factory = new Function(...source.params, source.body) as RefreshFactory;
            generated.set(key, factory);
        }
        return { factory };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a sequence of attribute definitions resolved to. No factory means the fallback. */
interface ResolvedFactory {
    readonly factory: RefreshFactory | undefined;
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
                '[mvt-utils/jsx] This page\'s Content Security Policy blocks new Function, so JSX bindings are '
                + 'refreshed by a slower fallback (6-16x slower per bound element on Pixi, measured). Add '
                + '\'unsafe-eval\' to script-src, or define __MVT_JSX_EVAL__ as false to skip this check and this warning.',
            );
        }
        return false;
    }
}

/**
 * The fallback: one refresh body, shared by every element, looping over
 * arrays. The same writes and the same read counts as the generated methods,
 * several times slower (see {@link createRefreshBuilder}).
 */
function buildFallback(el: unknown, bindings: readonly Binding[], hasVisible: boolean): RefreshMethod {
    const count = bindings.length;
    const getters: (() => unknown)[] = [];
    const applies: ((el: unknown, value: unknown) => void)[] = [];
    const kinds: WriteKind[] = [];
    const lastValues: unknown[] = [];
    const lastNumbers = new Float64Array(count).fill(NaN);
    for (let i = 0; i < count; i++) {
        getters.push(bindings[i].getter);
        applies.push(bindings[i].apply);
        kinds.push(bindings[i].kind);
        lastValues.push(UNSET);
    }

    return () => {
        let first = 0;
        if (hasVisible) {
            if (readCounter.isCounting) readCounter.count++;
            if (!write(0)) return SKIP_DESCENDANTS;
            if (readCounter.isCounting) readCounter.count += count - 1;
            first = 1;
        }
        else if (readCounter.isCounting) {
            readCounter.count += count;
        }
        for (let i = first; i < count; i++) write(i);
    };

    /** Reads binding `i` and writes it as its kind says. Returns the value read. */
    function write(i: number): unknown {
        const value = getters[i]();
        const kind = kinds[i];
        if (kind === 'every-frame') {
            applies[i](el, value);
        }
        else if (kind === 'on-change') {
            if (value !== lastValues[i]) {
                lastValues[i] = value;
                applies[i](el, value);
            }
        }
        else if (value !== lastNumbers[i]) {
            lastNumbers[i] = value as number;
            applies[i](el, value);
        }
        return value;
    }
}
