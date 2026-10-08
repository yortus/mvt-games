import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng, encodePng, hashPicture, type Picture, readPngHash } from './png';

const dir = mkdtempSync(join(tmpdir(), 'visual-png-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function picture(width: number, height: number, seed: number): Picture {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * seed + (i >> 3)) & 0xff;
    return { width, height, pixels };
}

describe('encodePng', () => {
    it('decodes to the same pixels', () => {
        const p = picture(37, 21, 7);
        const back = decodePng(encodePng(p));
        expect(back.width).toBe(37);
        expect(back.height).toBe(21);
        expect([...back.pixels]).toEqual([...p.pixels]);
    });

    it('gives the same bytes for the same pixels', () => {
        expect(encodePng(picture(16, 16, 3))).toEqual(encodePng(picture(16, 16, 3)));
    });

    it('carries the hash of the pixels, read from the file\'s first bytes', () => {
        const p = picture(64, 48, 5);
        const file = join(dir, 'p.png');
        writeFileSync(file, encodePng(p));
        expect(readPngHash(file)).toBe(hashPicture(p));
    });
});

describe('hashPicture', () => {
    it('depends on the size, not only the pixels', () => {
        const pixels = new Uint8Array(4 * 4 * 4);
        expect(hashPicture({ width: 4, height: 4, pixels })).not.toBe(hashPicture({ width: 2, height: 8, pixels }));
    });
});

describe('readPngHash', () => {
    it('is undefined for a PNG without one', () => {
        const file = join(dir, 'plain.png');
        // A minimal PNG's signature and header, with no text chunk after it
        writeFileSync(file, Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'));
        expect(readPngHash(file)).toBeUndefined();
    });
});
