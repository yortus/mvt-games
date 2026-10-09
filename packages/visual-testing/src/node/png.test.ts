import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng, encodePng, hashPicture, type Picture, readPngHash } from './png';

const dir = mkdtempSync(join(tmpdir(), 'visual-png-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function createPicture(width: number, height: number, seed: number): Picture {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * seed + (i >> 3)) & 0xff;
    return { width, height, pixels };
}

describe('encodePng', () => {
    it('decodes to the same pixels', () => {
        const p = createPicture(37, 21, 7);
        const back = decodePng(encodePng(p));
        expect(back.width).toBe(37);
        expect(back.height).toBe(21);
        expect([...back.pixels]).toEqual([...p.pixels]);
    });

    it('gives the same bytes for the same pixels', () => {
        expect(encodePng(createPicture(16, 16, 3))).toEqual(encodePng(createPicture(16, 16, 3)));
    });

    it('carries the hash of the pixels, which readPngHash reads from the file\'s first bytes', () => {
        const p = createPicture(64, 48, 5);
        const file = join(dir, 'p.png');
        writeFileSync(file, encodePng(p));
        expect(readPngHash(file)).toBe(hashPicture(p));
    });
});

describe('encodePng, in each form it can choose', () => {
    function createColouredPicture(width: number, height: number, count: number, alpha = 255): Picture {
        const pixels = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            const c = (i * 7) % count;
            pixels.set([c * 3, 255 - c, (c * 11) & 0xff, i % 5 === 0 ? alpha : 255], i * 4);
        }
        return { width, height, pixels };
    }

    // The width of 13 leaves a partly filled byte at the end of each row, at
    // each palette bit depth below 8.
    for (const [count, name] of [[2, '1-bit'], [4, '2-bit'], [16, '4-bit'], [200, '8-bit']] as const) {
        it(`round-trips a ${name} palette`, () => {
            const p = createColouredPicture(13, 7, count);
            expect([...decodePng(encodePng(p)).pixels]).toEqual([...p.pixels]);
        });
    }

    it('round-trips a palette with transparent colours', () => {
        const p = createColouredPicture(9, 5, 12, 40);
        expect([...decodePng(encodePng(p)).pixels]).toEqual([...p.pixels]);
    });

    it('round-trips more than 256 colours, both opaque (RGB) and not (RGBA)', () => {
        for (const alpha of [255, 90]) {
            const p = createColouredPicture(41, 23, 943, alpha);
            expect([...decodePng(encodePng(p)).pixels]).toEqual([...p.pixels]);
        }
    });

    it('makes a flat picture small', () => {
        expect(encodePng(createColouredPicture(200, 100, 4)).length).toBeLessThan(800);
    });
});

describe('hashPicture', () => {
    it('depends on the size, not only the pixels', () => {
        const pixels = new Uint8Array(4 * 4 * 4);
        expect(hashPicture({ width: 4, height: 4, pixels })).not.toBe(hashPicture({ width: 2, height: 8, pixels }));
    });
});

describe('readPngHash', () => {
    it('returns undefined for a PNG without a hash', () => {
        const file = join(dir, 'plain.png');
        // These bytes are a minimal PNG's signature and header, with no text
        // chunk after them.
        writeFileSync(file, Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'));
        expect(readPngHash(file)).toBeUndefined();
    });
});
