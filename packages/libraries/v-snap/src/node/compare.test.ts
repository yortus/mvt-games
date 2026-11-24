import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareImages, TOLERANCE } from './compare.ts';
import { decodePng, type RgbaImage } from './png.ts';

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

    describe('across shader compilers, where a pixel may also change as much as one sample crossing an edge could', () => {
        // An 8x8 image, dark on its left half and bright on its right, so the pixels in columns 3 and 4 lie on an edge
        const DARK = 20;
        const createEdge = (bright: number) => {
            const image = createFlatImage(8, 8, [DARK, DARK, DARK, 255]);
            for (let y = 0; y < 8; y++) for (let x = 4; x < 8; x++) image.pixels[(y * 8 + x) * 4] = bright;
            return image;
        };
        const changePixel = (image: RgbaImage, x: number, y: number, red: number) => {
            const changed = { ...image, pixels: image.pixels.slice() };
            changed.pixels[(y * 8 + x) * 4] = red;
            return changed;
        };

        it('passes a pixel on an edge that changed by up to the step across it, plus the tolerance', () => {
            const expected = createEdge(DARK + 40);
            const c = compareImages({ expected, actual: changePixel(expected, 3, 4, DARK + 40 + TOLERANCE), isAcrossShaderCompilers: true });
            expect(c.isClose).toBe(true);
            expect(c.excused).toBe(1);
            expect([...c.diff.pixels.subarray((4 * 8 + 3) * 4, (4 * 8 + 3) * 4 + 3)]).not.toEqual([255, 0, 0]);
        });

        it('fails a pixel on an edge that changed by one more than that, along with all its neighbours', () => {
            // The pixel's neighbours changed to its new colour too, so the actual image is flat round it, and only the edge in
            // the reference excuses it
            const expected = createEdge(DARK + 40);
            let actual = expected;
            for (let y = 3; y <= 5; y++) for (let x = 2; x <= 4; x++) actual = changePixel(actual, x, y, DARK + 40 + TOLERANCE + 1);
            const c = compareImages({ expected, actual, isAcrossShaderCompilers: true });
            expect(c.isClose).toBe(false);
            expect(c.changedRect).toEqual({ x: 3, y: 4, width: 1, height: 1 });
        });

        it('fails the same change on an edge when one shader compiler drew both images', () => {
            const expected = createEdge(DARK + 40);
            expect(compareImages({ expected, actual: changePixel(expected, 3, 4, DARK + 40) }).isClose).toBe(false);
        });

        it('fails the middle of an area that changed, which is flat in both images', () => {
            const expected = createFlatImage(8, 8, [DARK, DARK, DARK, 255]);
            let actual = expected;
            for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) actual = changePixel(actual, x, y, DARK + 50);
            const c = compareImages({ expected, actual, isAcrossShaderCompilers: true });
            // The area's 8 border pixels each step to the unchanged pixels beside them, but its middle pixel has no step
            expect(c.excused).toBe(8);
            expect(c.exceeded).toBe(1);
            expect(c.changedRect).toEqual({ x: 3, y: 3, width: 1, height: 1 });
        });

        it('passes a lone pixel that only one image shows, by its step in that image, as for a line thinner than a pixel', () => {
            const expected = createFlatImage(8, 8, [DARK, DARK, DARK, 255]);
            expect(compareImages({ expected, actual: changePixel(expected, 3, 3, DARK + 50), isAcrossShaderCompilers: true }).isClose).toBe(true);
        });

        // Crops of images that arm64 machines, whose SwiftShader uses LLVM, drew differently from their references, which x64
        // machines drew with Subzero: one long, shallow edge moved by one sample, pixels along diagonal edges, and one pixel of a thin line
        for (const name of ['shallow-edge', 'diagonal-edges', 'thin-line']) {
            it(`passes the real difference in '${name}', which fails when one shader compiler drew both`, () => {
                const folder = resolve(import.meta.dirname, '..', '..', 'fixtures', 'shader-compilers');
                const expected = decodePng(readFileSync(join(folder, `${name}.subzero.png`)));
                const actual = decodePng(readFileSync(join(folder, `${name}.llvm.png`)));
                const across = compareImages({ expected, actual, isAcrossShaderCompilers: true });
                expect({ isClose: across.isClose, hasExcused: across.excused > 0 }).toEqual({ isClose: true, hasExcused: true });
                expect(compareImages({ expected, actual }).isClose).toBe(false);
            });
        }
    });
});
