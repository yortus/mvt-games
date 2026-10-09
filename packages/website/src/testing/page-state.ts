import { BatchableGraphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Replaces `Math.random` with a small seeded generator (mulberry32), and
 * returns a function that resets it to its seed. The visual tests reset it
 * before every test. That way, models that call `Math.random()` get the same
 * numbers on every run, whatever ran before.
 */
export function installSeededRandom(seed: number): () => void {
    let state = seed;
    Math.random = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return () => {
        state = seed;
    };
}

/**
 * Patches a Pixi bug that lets one picture change the next. In Pixi 8.21,
 * `BatchableGraphics.reset()` leaves `roundPixels` as it was. So a batch
 * that a rounded (pixel-art) graphic returned to the pool rounds the curves
 * of the next graphics context built from the pool. This patch clears
 * `roundPixels` on reset, until Pixi does that itself.
 */
export function patchPixiPools(): void {
    const reset = BatchableGraphics.prototype.reset;
    BatchableGraphics.prototype.reset = function (this: BatchableGraphics) {
        reset.call(this);
        this.roundPixels = 0;
    };
}
