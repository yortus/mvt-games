import { describe, expect, it } from 'vitest';
import { compareImages, SCATTER_AREA, SCATTER_CLUMP, TOLERANCE } from './compare.ts';
import type { RgbaImage } from './png.ts';

function createFlatImage(width: number, height: number, rgba: readonly number[]): RgbaImage {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set(rgba, i);
    return { width, height, pixels };
}

describe('compareImages', () => {
    it('finds nothing in identical images', () => {
        const c = compareImages({ expected: createFlatImage(4, 4, [10, 20, 30, 255]), actual: createFlatImage(4, 4, [10, 20, 30, 255]) });
        expect(c.changed).toBe(0);
        expect(c.maxDelta).toBe(0);
        expect(c.isWithinTolerance).toBe(true);
    });

    it('passes a difference as large as the tolerance, in every pixel', () => {
        const c = compareImages({ expected: createFlatImage(8, 8, [100, 100, 100, 255]), actual: createFlatImage(8, 8, [100 + TOLERANCE, 100, 100, 255]) });
        expect(c.changed).toBe(64);
        expect(c.isWithinTolerance).toBe(true);
    });

    it('fails a difference one larger than the tolerance, in one pixel', () => {
        const actual = createFlatImage(8, 8, [100, 100, 100, 255]);
        actual.pixels[2] = 100 + TOLERANCE + 1;
        const c = compareImages({ expected: createFlatImage(8, 8, [100, 100, 100, 255]), actual });
        expect(c.changed).toBe(1);
        expect(c.maxDelta).toBe(TOLERANCE + 1);
        expect(c.isWithinTolerance).toBe(false);
    });

    it('gives the smallest rectangle holding every pixel that differs', () => {
        const actual = createFlatImage(8, 8, [100, 100, 100, 255]);
        actual.pixels[(2 * 8 + 5) * 4] = 0;
        actual.pixels[(6 * 8 + 3) * 4] = 0;
        const c = compareImages({ expected: createFlatImage(8, 8, [100, 100, 100, 255]), actual });
        expect(c.changedRect).toEqual({ x: 3, y: 2, width: 3, height: 5 });
        expect(compareImages({ expected: actual, actual }).changedRect).toBeUndefined();
    });

    it('marks differing pixels red in the diff', () => {
        const actual = createFlatImage(2, 1, [0, 0, 0, 255]);
        actual.pixels[4] = 50;
        const c = compareImages({ expected: createFlatImage(2, 1, [0, 0, 0, 255]), actual });
        expect([...c.diff.pixels.subarray(4, 8)]).toEqual([255, 0, 0, 255]);
        expect(c.diff.pixels[0]).toBe(0);
    });

    it('keeps differences within the tolerance out of the rectangle when a larger one is found', () => {
        // Rounding all over, and one real change in one pixel
        const actual = createFlatImage(8, 8, [100 + TOLERANCE, 100, 100, 255]);
        actual.pixels.set([0, 0, 0, 255], (5 * 8 + 6) * 4);
        const c = compareImages({ expected: createFlatImage(8, 8, [100, 100, 100, 255]), actual });
        expect(c.changed).toBe(64);
        expect(c.exceeded).toBe(1);
        expect(c.changedRect).toEqual({ x: 6, y: 5, width: 1, height: 1 });
    });

    it('marks differences within the tolerance in a colour other than red', () => {
        const actual = createFlatImage(2, 1, [0, 0, 0, 255]);
        actual.pixels[0] = TOLERANCE;
        actual.pixels[4] = TOLERANCE + 1;
        const c = compareImages({ expected: createFlatImage(2, 1, [0, 0, 0, 255]), actual });
        expect([...c.diff.pixels.subarray(4, 8)]).toEqual([255, 0, 0, 255]);
        expect([...c.diff.pixels.subarray(0, 4)]).not.toEqual([255, 0, 0, 255]);
        expect(c.diff.pixels[0]).toBeGreaterThan(0);
    });

    describe('scattered pixels, which arm64 processors draw along the edges of 3D shapes', () => {
        // An image with room for this many scattered pixels, each a long way past the tolerance
        const ALLOWED = 4;
        const WIDTH = 200;
        const HEIGHT = (ALLOWED * SCATTER_AREA) / WIDTH;
        const compareWith = (points: readonly (readonly [number, number])[]) => {
            const actual = createFlatImage(WIDTH, HEIGHT, [100, 100, 100, 255]);
            for (const [x, y] of points) actual.pixels[(y * WIDTH + x) * 4] = 0;
            return compareImages({ expected: createFlatImage(WIDTH, HEIGHT, [100, 100, 100, 255]), actual });
        };
        // A clump as large as is allowed, in a row, and the rest of the allowance one by one, apart
        const clump = Array.from({ length: SCATTER_CLUMP }, (_, i) => [10 + i, 10] as const);
        const apart = Array.from({ length: ALLOWED - SCATTER_CLUMP }, (_, i) => [50 + 20 * i, 100] as const);

        it('counts as many as the image\'s area allows as scattered, apart or in small clumps', () => {
            const c = compareWith([...clump, ...apart]);
            expect(c.isWithinTolerance).toBe(false);
            expect(c.isScattered).toBe(true);
        });

        it('counts one more than the area allows as more than scattered', () => {
            expect(compareWith([...clump, ...apart, [190, 190]]).isScattered).toBe(false);
        });

        it('counts a clump one larger than allowed as more than scattered, even touching only diagonally', () => {
            const last = clump[clump.length - 1];
            expect(compareWith([...clump, [last[0] + 1, last[1] + 1]]).isScattered).toBe(false);
        });
    });
});
