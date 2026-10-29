// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Replaces the page's sources of random numbers with small seeded
 * generators (mulberry32), and returns a function that resets them to their
 * seeds. The visual tests reset them before every test. That way, views and
 * models get the same numbers on every run, whatever ran before. It replaces
 * `Math.random`, and `crypto.getRandomValues` and `crypto.randomUUID`, which
 * draw from a second generator, so that a call to one doesn't change the
 * numbers that the other gives. `crypto.subtle` is left alone.
 */
export function installSeededRandom(seed: number): () => void {
    const math = createGenerator(seed);
    const bytes = createGenerator(seed ^ 0x2545f491);
    Math.random = () => math.next() / 4294967296;
    const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
        if (!ArrayBuffer.isView(array) || array instanceof Float32Array || array instanceof Float64Array || array instanceof DataView) {
            throw new TypeError('crypto.getRandomValues takes an integer typed array.');
        }
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < view.length; i++) view[i] = bytes.next() & 0xff;
        return array;
    };
    const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
        const b = getRandomValues(new Uint8Array(16));
        // A version 4 UUID: its version and variant bits are fixed
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
    Object.defineProperty(crypto, 'getRandomValues', { value: getRandomValues, configurable: true, writable: true });
    Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true, writable: true });
    return () => {
        math.reset();
        bytes.reset();
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns a mulberry32 generator of 32-bit unsigned integers, which can be reset to its seed. */
function createGenerator(seed: number): { readonly next: () => number; readonly reset: () => void } {
    let state = seed;
    return {
        next: () => {
            state = (state + 0x6d2b79f5) | 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return (t ^ (t >>> 14)) >>> 0;
        },
        reset: () => {
            state = seed;
        },
    };
}
