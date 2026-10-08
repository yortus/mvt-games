import { describe, expect, it } from 'vitest';
import { comparePictures, TOLERANCE } from './compare';
import type { Picture } from './png';

function flat(width: number, height: number, rgba: readonly number[]): Picture {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set(rgba, i);
    return { width, height, pixels };
}

describe('comparePictures', () => {
    it('finds nothing in identical pictures', () => {
        const c = comparePictures({ expected: flat(4, 4, [10, 20, 30, 255]), actual: flat(4, 4, [10, 20, 30, 255]) });
        expect(c.changed).toBe(0);
        expect(c.maxDelta).toBe(0);
        expect(c.isWithinTolerance).toBe(true);
    });

    it('passes a difference as large as the tolerance, in every pixel', () => {
        const c = comparePictures({ expected: flat(8, 8, [100, 100, 100, 255]), actual: flat(8, 8, [100 + TOLERANCE, 100, 100, 255]) });
        expect(c.changed).toBe(64);
        expect(c.isWithinTolerance).toBe(true);
    });

    it('fails a difference one larger than the tolerance, in one pixel', () => {
        const actual = flat(8, 8, [100, 100, 100, 255]);
        actual.pixels[2] = 100 + TOLERANCE + 1;
        const c = comparePictures({ expected: flat(8, 8, [100, 100, 100, 255]), actual });
        expect(c.changed).toBe(1);
        expect(c.maxDelta).toBe(TOLERANCE + 1);
        expect(c.isWithinTolerance).toBe(false);
    });

    it('gives the smallest rectangle holding every pixel that differs', () => {
        const actual = flat(8, 8, [100, 100, 100, 255]);
        actual.pixels[(2 * 8 + 5) * 4] = 0;
        actual.pixels[(6 * 8 + 3) * 4] = 0;
        const c = comparePictures({ expected: flat(8, 8, [100, 100, 100, 255]), actual });
        expect(c.changedRect).toEqual({ x: 3, y: 2, width: 3, height: 5 });
        expect(comparePictures({ expected: actual, actual }).changedRect).toBeUndefined();
    });

    it('marks differing pixels red in the diff', () => {
        const actual = flat(2, 1, [0, 0, 0, 255]);
        actual.pixels[4] = 50;
        const c = comparePictures({ expected: flat(2, 1, [0, 0, 0, 255]), actual });
        expect([...c.diff.pixels.subarray(4, 8)]).toEqual([255, 0, 0, 255]);
        expect(c.diff.pixels[0]).toBe(0);
    });
});
