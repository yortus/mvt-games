// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Returns a number from 0 up to, but not including, 1. */
export type Random = () => number;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SeededRandomOptions {
    /** Any whole number. The same seed gives the same numbers, in the same order. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a source of random numbers that repeats: the same seed gives the
 * same numbers every run. It's the small, well-known Mulberry32 generator.
 */
export function createSeededRandom({ seed }: SeededRandomOptions): Random {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
