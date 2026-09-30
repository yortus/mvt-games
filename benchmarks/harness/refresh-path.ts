import type { ParamValue } from './suite';

// ---------------------------------------------------------------------------
// The JSX runtime's refresh path, for a case's `refresh` param
// ---------------------------------------------------------------------------

/** How many refresh methods a JSX runtime has made each way (`refreshMethodCounts`). */
interface RefreshMethodCounts {
    readonly precompiled: number;
    readonly generated: number;
    readonly fallback: number;
}

/**
 * Selects how the JSX runtime refreshes elements in this process: `generated`
 * (the default), what a page that allows `new Function` gets, or `fallback`,
 * what a page whose Content Security Policy forbids it gets. The fallback is
 * forced as an app that defines `__MVT_JSX_EVAL__` as `false` at build time
 * forces it: the runtime reads it the first time it builds a bound element,
 * so call this before any is built.
 */
export function selectRefreshPath(refresh: ParamValue | undefined): void {
    if (refresh === undefined || refresh === 'generated') return;
    if (refresh !== 'fallback') throw new Error(`unknown refresh path: ${refresh}`);
    (globalThis as { __MVT_JSX_EVAL__?: boolean }).__MVT_JSX_EVAL__ = false;
}

/** Throws if any bound element was refreshed some other way than the one selected. */
export function checkRefreshPath(refresh: ParamValue | undefined, counts: RefreshMethodCounts): void {
    const isFallback = refresh === 'fallback';
    const other = isFallback ? counts.generated + counts.precompiled : counts.fallback + counts.precompiled;
    if (other > 0) throw new Error(`expected every refresh method to be ${isFallback ? 'the fallback' : 'generated'}, got ${JSON.stringify(counts)}`);
}
