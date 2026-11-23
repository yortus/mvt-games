/**
 * Compares an actual image with its reference, within the visual tests'
 * tolerance. An actual image passes if no channel of any pixel differs by
 * more than `TOLERANCE` levels out of 255. The tolerance applies to each
 * channel, and it is not a count of pixels. This is because arm64
 * processors round blurs, rotated images and some edges differently, by 1
 * or 2 levels over thousands of pixels. A pixel count small enough to catch
 * a real change would fail on those images.
 *
 * arm64 processors also draw an odd pixel along the edge of a 3D shape
 * differently, by more than the tolerance. So on arm64, an image also
 * passes if the pixels past the tolerance are few and scattered: at most
 * one in `SCATTER_AREA`, in clumps of at most `SCATTER_CLUMP` pixels. A
 * real change is almost always a clump of more.
 *
 * Other processors draw exactly the same images, so on them a difference
 * within the tolerance is a small real change. Vitest's `-u` rewrites such a
 * reference there, but not on arm64, so that an arm64 machine doesn't keep
 * rewriting references that it rounds differently.
 */

import type { VisualRect } from '../protocol.ts';
import type { RgbaImage } from './png.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Comparison {
    /** The number of pixels that differ at all. */
    readonly changed: number;
    /** The number of pixels that differ by more than the tolerance. */
    readonly exceeded: number;
    /** The largest difference in any channel of any pixel, 0 to 255. */
    readonly maxDelta: number;
    /**
     * The smallest rectangle holding every pixel that differs by more than
     * the tolerance, or, if none does, every pixel that differs at all. So
     * rounding within the tolerance doesn't spread it over a real change.
     */
    readonly changedRect: VisualRect | undefined;
    /** Whether the largest difference is within the tolerance. */
    readonly isWithinTolerance: boolean;
    /** Whether the pixels past the tolerance, if any, are few and scattered, as arm64 processors draw some edges. */
    readonly isScattered: boolean;
    /** The reference dimmed, with each pixel that differs by more than the tolerance in red, and each that differs by less in dark yellow. */
    readonly diff: RgbaImage;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const TOLERANCE = 2;

/** An image may have one scattered pixel past the tolerance for each this many pixels, and always one. */
export const SCATTER_AREA = 10_000;

/** The most pixels past the tolerance that may touch, side by side or diagonally, in an image whose pixels past it are scattered. */
export const SCATTER_CLUMP = 2;

/** Whether this machine's processor draws exactly the reference environment's images, as every processor but arm64 does. */
export const DRAWS_EXACTLY = process.arch !== 'arm64';

/** Compares two images of the same size. */
export function compareImages(options: { readonly expected: RgbaImage; readonly actual: RgbaImage }): Comparison {
    const { expected, actual } = options;
    const { width, height } = expected;
    const diff = new Uint8Array(width * height * 4);
    let changed = 0;
    let exceeded = 0;
    let maxDelta = 0;
    // Which pixels differ by more than the tolerance, to find their clumps
    const isExceeded = new Uint8Array(width * height);
    const all = createBounds(width, height);
    const beyond = createBounds(width, height);
    for (let i = 0; i < diff.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(expected.pixels[i + c] - actual.pixels[i + c]));
        if (delta > 0) {
            changed++;
            maxDelta = Math.max(maxDelta, delta);
            const x = (i / 4) % width;
            const y = Math.floor(i / 4 / width);
            all.add(x, y);
            if (delta > TOLERANCE) {
                exceeded++;
                isExceeded[i / 4] = 1;
                beyond.add(x, y);
                diff.set(EXCEEDED_COLOUR, i);
            }
            else {
                diff.set(WITHIN_COLOUR, i);
            }
        }
        else {
            const grey = ((expected.pixels[i] + expected.pixels[i + 1] + expected.pixels[i + 2]) / 3) * 0.3;
            diff[i] = diff[i + 1] = diff[i + 2] = grey;
        }
        diff[i + 3] = 255;
    }
    const changedRect = exceeded > 0 ? beyond.toRect() : all.toRect();
    const isScattered = exceeded <= Math.max(1, Math.floor((width * height) / SCATTER_AREA)) && findLargestClump({ isExceeded, width, height }) <= SCATTER_CLUMP;
    return { changed, exceeded, maxDelta, changedRect, isWithinTolerance: maxDelta <= TOLERANCE, isScattered, diff: { width, height, pixels: diff } };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The diff's colour for a pixel that differs by more than the tolerance. */
const EXCEEDED_COLOUR = [255, 0, 0];

/** The diff's colour for a pixel that differs by no more than the tolerance, dim enough that a real change stands out. */
const WITHIN_COLOUR = [140, 110, 0];

/**
 * Returns how many pixels are in the largest clump of marked pixels, where
 * pixels side by side or diagonally are in one clump. It stops counting a
 * clump once it is larger than `SCATTER_CLUMP`, since then the answer is
 * already known.
 */
function findLargestClump(options: { readonly isExceeded: Uint8Array; readonly width: number; readonly height: number }): number {
    const { width, height } = options;
    const isUnvisited = options.isExceeded.slice();
    let largest = 0;
    for (let start = 0; start < isUnvisited.length && largest <= SCATTER_CLUMP; start++) {
        if (isUnvisited[start] === 0) continue;
        isUnvisited[start] = 0;
        const stack = [start];
        let size = 0;
        while (stack.length > 0 && size <= SCATTER_CLUMP) {
            const p = stack.pop() as number;
            size++;
            const x = p % width;
            const y = Math.floor(p / width);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const n = ny * width + nx;
                    if (isUnvisited[n] === 1) {
                        isUnvisited[n] = 0;
                        stack.push(n);
                    }
                }
            }
        }
        largest = Math.max(largest, size);
    }
    return largest;
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
