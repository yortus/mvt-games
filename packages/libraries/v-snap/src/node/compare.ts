/**
 * Compares an actual image with its reference.
 *
 * When the same shader compiler drew both (see `src/shared/shader-compiler.ts`),
 * the actual image passes if every channel of every pixel is within
 * `TOLERANCE` levels out of 255. The tolerance applies to each channel, and
 * it is not a count of pixels. Machines with the same shader compiler draw
 * exactly the same images, so a difference here is a real change, however
 * small.
 *
 * When different shader compilers drew them, a pixel may also differ by as
 * much as one sample crossing an edge could change it. With antialiasing, a
 * pixel's colour is the average of several samples. The two shader compilers
 * round some arithmetic differently. That can move an edge by a tiny
 * fraction of a pixel, and so put one sample on the other side of it. The
 * sample changes the pixel by its share of the colour difference across the
 * edge. That share is never more than the pixel's largest step to one of
 * its 8 neighbours, in one image or the other.
 *
 * So the rule is that a pixel passes if, in each channel, it differs by at
 * most the tolerance plus that step. A pixel that changes where both images
 * are flat has a step of 0, so it fails. The limit comes from how drawing
 * works, not from any set of images.
 */

import type { VisualRect } from '../protocol.ts';
import type { RgbaImage } from './png.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Comparison {
    /** The number of pixels that differ at all. */
    readonly changed: number;
    /** The number of pixels past the tolerance that one sample crossing an edge could explain. Only images from different shader compilers have any. */
    readonly excused: number;
    /** The number of pixels that differ by more than everything allowed. */
    readonly exceeded: number;
    /** The largest difference in any channel of any pixel, 0 to 255. */
    readonly maxDelta: number;
    /**
     * The smallest rectangle holding every pixel past everything allowed,
     * or, if none is, every pixel that differs at all. So rounding within
     * what's allowed doesn't spread it over a real change.
     */
    readonly changedRect: VisualRect | undefined;
    /** Whether every pixel is within the tolerance. */
    readonly isWithinTolerance: boolean;
    /** Whether every pixel is within what's allowed, so that the image passes. */
    readonly isClose: boolean;
    /**
     * The reference dimmed, with each pixel past everything allowed in red,
     * each that one sample crossing an edge could explain in orange, and
     * each within the tolerance in dark yellow.
     */
    readonly diff: RgbaImage;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const TOLERANCE = 2;

/**
 * Compares two images of the same size. Pass `isAcrossShaderCompilers` when
 * different shader compilers drew them, so that a pixel may also differ by
 * as much as one sample crossing an edge could change it.
 */
export function compareImages(options: { readonly expected: RgbaImage; readonly actual: RgbaImage; readonly isAcrossShaderCompilers?: boolean }): Comparison {
    const { expected, actual } = options;
    const isAcross = options.isAcrossShaderCompilers ?? false;
    const { width, height } = expected;
    const diff = new Uint8Array(width * height * 4);
    let changed = 0;
    let excused = 0;
    let exceeded = 0;
    let maxDelta = 0;
    const all = createBounds(width, height);
    const beyond = createBounds(width, height);
    for (let i = 0; i < diff.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(expected.pixels[i + c] - actual.pixels[i + c]));
        if (delta === 0) {
            const grey = ((expected.pixels[i] + expected.pixels[i + 1] + expected.pixels[i + 2]) / 3) * 0.3;
            diff[i] = diff[i + 1] = diff[i + 2] = grey;
            diff[i + 3] = 255;
            continue;
        }
        changed++;
        maxDelta = Math.max(maxDelta, delta);
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);
        all.add(x, y);
        if (delta <= TOLERANCE) {
            diff.set(WITHIN_COLOUR, i);
        }
        else if (isAcross && isOneSampleChange({ expected, actual, x, y })) {
            excused++;
            diff.set(EXCUSED_COLOUR, i);
        }
        else {
            exceeded++;
            beyond.add(x, y);
            diff.set(EXCEEDED_COLOUR, i);
        }
        diff[i + 3] = 255;
    }
    const changedRect = exceeded > 0 ? beyond.toRect() : all.toRect();
    return { changed, excused, exceeded, maxDelta, changedRect, isWithinTolerance: maxDelta <= TOLERANCE, isClose: exceeded === 0, diff: { width, height, pixels: diff } };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The diff's colour for a pixel past everything allowed. */
const EXCEEDED_COLOUR = [255, 0, 0];

/** The diff's colour for a pixel that one sample crossing an edge could explain. */
const EXCUSED_COLOUR = [255, 140, 0];

/** The diff's colour for a pixel that differs by no more than the tolerance, dim enough that a real change stands out. */
const WITHIN_COLOUR = [140, 110, 0];

/**
 * Returns whether a pixel differs, in each channel, by at most the
 * tolerance plus its largest step to one of its 8 neighbours, in either
 * image. That's as much as one sample crossing an edge can change it.
 */
function isOneSampleChange(options: { readonly expected: RgbaImage; readonly actual: RgbaImage; readonly x: number; readonly y: number }): boolean {
    const { expected, actual, x, y } = options;
    const i = (y * expected.width + x) * 4;
    for (let c = 0; c < 4; c++) {
        const delta = Math.abs(expected.pixels[i + c] - actual.pixels[i + c]);
        if (delta <= TOLERANCE) continue;
        const step = Math.max(findLargestStep({ image: expected, x, y, channel: c }), findLargestStep({ image: actual, x, y, channel: c }));
        if (delta > TOLERANCE + step) return false;
    }
    return true;
}

/** Returns the largest difference, in one channel, between a pixel and any of its 8 neighbours. */
function findLargestStep(options: { readonly image: RgbaImage; readonly x: number; readonly y: number; readonly channel: number }): number {
    const { image, x, y, channel } = options;
    const { width, height, pixels } = image;
    const value = pixels[(y * width + x) * 4 + channel];
    let step = 0;
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            step = Math.max(step, Math.abs(pixels[(ny * width + nx) * 4 + channel] - value));
        }
    }
    return step;
}

/** Returns the bounds of some pixels, which grow as each is added. */
function createBounds(width: number, height: number) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    return {
        add: (x: number, y: number): void => {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
        },
        /** Returns the smallest rectangle holding every pixel added, or undefined if none was. */
        toRect: (): VisualRect | undefined => (right < 0 ? undefined : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }),
    };
}
