/**
 * Comparing a picture with its reference, within the visual tests'
 * tolerance: no channel of any pixel may differ by more than
 * `TOLERANCE` levels of 255. Per channel, not a count of pixels: arm64
 * processors round blurs, rotated images and some edges differently by 1 or
 * 2 levels over thousands of pixels, and a pixel count small enough to catch
 * a real change would fail them.
 */

import type { Picture } from './png';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Comparison {
    /** Pixels that differ at all. */
    readonly changed: number;
    /** The largest difference in any channel of any pixel, 0 to 255. */
    readonly maxDelta: number;
    /** Whether the largest difference is within the tolerance. */
    readonly isWithinTolerance: boolean;
    /** The reference dimmed, with every pixel that differs in red. */
    readonly diff: Picture;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const TOLERANCE = 2;

/** Compares two pictures of the same size. */
export function comparePictures(options: { readonly expected: Picture; readonly actual: Picture }): Comparison {
    const { expected, actual } = options;
    const { width, height } = expected;
    const diff = new Uint8Array(width * height * 4);
    let changed = 0;
    let maxDelta = 0;
    for (let i = 0; i < diff.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(expected.pixels[i + c] - actual.pixels[i + c]));
        if (delta > 0) {
            changed++;
            maxDelta = Math.max(maxDelta, delta);
            diff[i] = 255;
            diff[i + 1] = 0;
            diff[i + 2] = 0;
        }
        else {
            const grey = ((expected.pixels[i] + expected.pixels[i + 1] + expected.pixels[i + 2]) / 3) * 0.3;
            diff[i] = diff[i + 1] = diff[i + 2] = grey;
        }
        diff[i + 3] = 255;
    }
    return { changed, maxDelta, isWithinTolerance: maxDelta <= TOLERANCE, diff: { width, height, pixels: diff } };
}
