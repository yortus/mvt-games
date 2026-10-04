// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Small pure functions the part models build their closed forms from. Every
// value the show exposes is a function of time, so randomness comes from a
// stateless hash of an index rather than a generator advanced per frame.

export const TURN = Math.PI * 2;

export function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** 0 before `from`, 1 after `to`, and an S-curve between. */
export function smoothstep(from: number, to: number, value: number): number {
    const t = clamp01((value - from) / (to - from));
    return t * t * (3 - 2 * t);
}

/** `value` modulo `size`, always in `[0, size)`, for negative values too. */
export function wrap(value: number, size: number): number {
    const r = value % size;
    return r < 0 ? r + size : r;
}

/**
 * A number in `[0, 1)` that looks random but depends only on its two
 * integer inputs: the same inputs always give the same number. Chris
 * Wellons's lowbias32 integer hash.
 */
export function hash01(a: number, b: number): number {
    let x = (Math.imul(a | 0, 0x9e3779b1) ^ (b | 0)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
}

/**
 * The fade a part makes over its first and last `fadeMs`: 0 at its start and
 * end, 1 between.
 */
export function fadeInOut(elapsedMs: number, durationMs: number, fadeMs: number): number {
    return clamp01(Math.min(elapsedMs / fadeMs, (durationMs - elapsedMs) / fadeMs));
}
