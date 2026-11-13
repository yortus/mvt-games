// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A seeded source of random numbers in `[0, 1)`, using Marsaglia's xorshift32.
 * The same seed always gives the same sequence, so a game replays exactly.
 * Allocation-free per call.
 */
export interface Random {
    /** The next number in the sequence, in `[0, 1)`. */
    next: () => number;
    /** The next number in `[min, max)`. */
    between: (min: number, max: number) => number;
    /**
     * The generator's whole state, a whole number from 1 to 2^32 - 1. Setting
     * it back to a value read earlier replays the sequence from that point,
     * so a saved round starts again just as it did.
     */
    state: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RandomOptions {
    /** Any whole number. The same seed gives the same sequence. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a source of random numbers, starting from `seed`. */
export function createRandom(options: RandomOptions): Random {
    // Small seeds give xorshift small first numbers, so the seed is scrambled
    // first (MurmurHash3's finaliser), and nearby seeds start far apart.
    // xorshift gets stuck at zero, so zero is nudged to a fixed non-zero state.
    let x = options.seed | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x = (x ^ (x >>> 16)) || 0x9e3779b9;

    return {
        next,
        between: (min, max) => min + next() * (max - min),
        get state() { return x >>> 0; },
        set state(value) { x = (value | 0) || 0x9e3779b9; },
    };

    function next(): number {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }
}
