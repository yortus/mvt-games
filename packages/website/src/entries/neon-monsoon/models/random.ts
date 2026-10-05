// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A seeded source of random numbers in `[0, 1)`, using Marsaglia's xorshift32.
 * The same seed always produces the same sequence, so with the fixed step a
 * run replays exactly: tests can assert on a whole minute of play, and the
 * benchmark plays the same game every time. Allocation-free per call.
 *
 * The same generator as the falling sand demo's; the games and demos share no
 * code, so this is a copy.
 */
export interface Random {
    /** The next number in the sequence, in `[0, 1)`. */
    next: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRandom(seed: number): Random {
    // xorshift gets stuck at zero, so a zero seed is nudged to a fixed non-zero one.
    let x = seed | 0 || 0x9e3779b9;

    return { next };

    function next(): number {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }
}
