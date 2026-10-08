/**
 * Reference pictures as PNG files, with the hash of their pixels in a text
 * chunk right after the header, so a run reads every reference's hash from
 * its first hundred or so bytes without decoding it.
 */

import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A picture's pixels: RGBA, 8 bits a channel, rows from the top. */
export interface Picture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The hash a picture is known by: its size and the SHA-256 of its pixels.
 * The page computes the same (`src/testing/judge.ts`).
 */
export function hashPicture(picture: Picture): string {
    return `${picture.width}x${picture.height}:${createHash('sha256').update(picture.pixels).digest('hex').slice(0, 32)}`;
}

/** The PNG for a picture, with its hash in a `tEXt` chunk after the header. */
export function encodePng(picture: Picture): Uint8Array {
    const { width, height, pixels } = picture;
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    header[8] = 8; // bit depth
    header[9] = 6; // colour type: RGBA
    // Compression, filter method and interlace: all 0
    const text = new TextEncoder().encode(`${HASH_KEYWORD}\0${hashPicture(picture)}`);
    // Each row filtered with Up (2), which suits flat pictures well
    const stride = width * 4;
    const raw = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        const at = y * (stride + 1);
        raw[at] = 2;
        for (let x = 0; x < stride; x++) {
            const above = y === 0 ? 0 : pixels[(y - 1) * stride + x];
            raw[at + 1 + x] = (pixels[y * stride + x] - above) & 0xff;
        }
    }
    return concat([
        SIGNATURE,
        chunk('IHDR', header),
        chunk('tEXt', text),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', new Uint8Array(0)),
    ]);
}

/** Any PNG's pixels. */
export function decodePng(bytes: Uint8Array): Picture {
    const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return { width: png.width, height: png.height, pixels: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
}

/**
 * The hash a reference file carries, read from its first bytes, or
 * undefined if it carries none (a PNG not written by `encodePng`).
 */
export function readPngHash(path: string): string | undefined {
    const head = new Uint8Array(160);
    const file = openSync(path, 'r');
    try {
        readSync(file, head, 0, head.length, 0);
    }
    finally {
        closeSync(file);
    }
    // Signature (8), IHDR (25), then the text chunk: length, type, keyword, NUL, text
    const view = new DataView(head.buffer);
    const length = view.getUint32(33);
    const type = String.fromCharCode(...head.subarray(37, 41));
    if (type !== 'tEXt' || 41 + length > head.length) return undefined;
    const [keyword, value] = new TextDecoder().decode(head.subarray(41, 41 + length)).split('\0');
    return keyword === HASH_KEYWORD ? value : undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const HASH_KEYWORD = 'mvt-pixels';

function chunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
