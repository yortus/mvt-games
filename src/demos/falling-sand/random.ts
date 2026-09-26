// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A seeded source of random numbers in `[0, 1)`, using Marsaglia's xorshift32.
 * The same seed always produces the same sequence, so a run of the simulation
 * can be replayed exactly by tests, thumbnails and benchmarks. Allocation-free
 * per call.
 */
export function createRandom(seed: number): () => number {
    // xorshift gets stuck at zero, so a zero seed is nudged to a fixed non-zero one.
    let x = seed | 0 || 0x9e3779b9;

    return random;

    function random(): number {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }
}
