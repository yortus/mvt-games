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

/**
 * The PNG for a picture, with its hash in a `tEXt` chunk after the header.
 * Lossless, and as small as a simple encoder makes it: a palette (1, 2, 4
 * or 8 bits a pixel) for a picture of 256 colours or fewer, as flat art
 * and pixel art usually are; otherwise RGB for an opaque picture (every
 * picture here is), RGBA for the rest, each row with whichever of PNG's
 * five filters suits it best. The same pixels always give the same bytes
 * from the same Node.
 */
export function encodePng(picture: Picture): Uint8Array {
    const { width, height } = picture;
    const text = new TextEncoder().encode(`${HASH_KEYWORD}\0${hashPicture(picture)}`);
    const indexed = toIndexed(picture);
    const extra: Uint8Array[] = [];
    let colourType: number;
    let bitDepth: number;
    let rows: Uint8Array;
    if (indexed !== undefined) {
        colourType = 3;
        bitDepth = indexed.bitDepth;
        extra.push(chunk('PLTE', indexed.palette));
        if (indexed.alphas !== undefined) extra.push(chunk('tRNS', indexed.alphas));
        // Palette rows are left unfiltered, as the PNG specification advises
        rows = withFilter(indexed.rows, Math.ceil((width * bitDepth) / 8), height);
    }
    else {
        const isOpaque = isAllOpaque(picture.pixels);
        colourType = isOpaque ? 2 : 6;
        bitDepth = 8;
        const channels = isOpaque ? 3 : 4;
        rows = filterAdaptively(isOpaque ? dropAlpha(picture.pixels) : picture.pixels, width * channels, height, channels);
    }
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    header[8] = bitDepth;
    header[9] = colourType;
    // Compression, filter method and interlace: all 0
    return concat([
        SIGNATURE,
        chunk('IHDR', header),
        chunk('tEXt', text),
        ...extra,
        chunk('IDAT', deflateSync(rows, { level: 9 })),
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

interface Indexed {
    readonly bitDepth: number;
    /** RGB triples, in the order the colours first appear. */
    readonly palette: Uint8Array;
    /** Each colour's alpha, if any is not opaque. */
    readonly alphas: Uint8Array | undefined;
    /** Each row's indices, packed at the bit depth, unfiltered. */
    readonly rows: Uint8Array;
}

/** The picture as palette indices, if it has 256 colours or fewer. */
function toIndexed(picture: Picture): Indexed | undefined {
    const { width, height, pixels } = picture;
    const words = new Uint32Array(pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength));
    const indexOf = new Map<number, number>();
    const colours: number[] = [];
    const indices = new Uint8Array(words.length);
    for (let i = 0; i < words.length; i++) {
        let index = indexOf.get(words[i]);
        if (index === undefined) {
            if (colours.length === 256) return undefined;
            index = colours.length;
            indexOf.set(words[i], index);
            colours.push(i);
        }
        indices[i] = index;
    }
    const bitDepth = colours.length <= 2 ? 1 : colours.length <= 4 ? 2 : colours.length <= 16 ? 4 : 8;
    const palette = new Uint8Array(colours.length * 3);
    const alphas = new Uint8Array(colours.length);
    let hasAlpha = false;
    for (let c = 0; c < colours.length; c++) {
        const at = colours[c] * 4;
        palette.set(pixels.subarray(at, at + 3), c * 3);
        alphas[c] = pixels[at + 3];
        if (alphas[c] !== 255) hasAlpha = true;
    }
    const rowBytes = Math.ceil((width * bitDepth) / 8);
    const rows = new Uint8Array(rowBytes * height);
    const perByte = 8 / bitDepth;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const shift = 8 - bitDepth * ((x % perByte) + 1);
            rows[y * rowBytes + Math.floor(x / perByte)] |= indices[y * width + x] << shift;
        }
    }
    return { bitDepth, palette, alphas: hasAlpha ? alphas : undefined, rows };
}

function isAllOpaque(pixels: Uint8Array): boolean {
    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 255) return false;
    }
    return true;
}

function dropAlpha(pixels: Uint8Array): Uint8Array {
    const rgb = new Uint8Array((pixels.length / 4) * 3);
    for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
        rgb[j] = pixels[i];
        rgb[j + 1] = pixels[i + 1];
        rgb[j + 2] = pixels[i + 2];
    }
    return rgb;
}

/** Rows each with filter byte 0 (none) in front. */
function withFilter(data: Uint8Array, rowBytes: number, height: number): Uint8Array {
    const out = new Uint8Array((rowBytes + 1) * height);
    for (let y = 0; y < height; y++) out.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
    return out;
}

/**
 * Each row with the filter (none, sub, up, average, Paeth) whose output has
 * the smallest sum of absolute values, the usual heuristic for what
 * compresses best.
 */
function filterAdaptively(data: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array {
    const out = new Uint8Array((rowBytes + 1) * height);
    const candidate = new Uint8Array(rowBytes);
    const best = new Uint8Array(rowBytes);
    for (let y = 0; y < height; y++) {
        const row = data.subarray(y * rowBytes, (y + 1) * rowBytes);
        const above = y === 0 ? undefined : data.subarray((y - 1) * rowBytes, y * rowBytes);
        let bestFilter = 0;
        let bestScore = Infinity;
        for (let filter = 0; filter < 5; filter++) {
            let score = 0;
            for (let x = 0; x < rowBytes; x++) {
                const a = x >= bpp ? row[x - bpp] : 0;
                const b = above === undefined ? 0 : above[x];
                const c = x >= bpp && above !== undefined ? above[x - bpp] : 0;
                const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
                const value = (row[x] - predictor) & 0xff;
                candidate[x] = value;
                score += value < 128 ? value : 256 - value;
            }
            if (score < bestScore) {
                bestScore = score;
                bestFilter = filter;
                best.set(candidate);
            }
        }
        const at = y * (rowBytes + 1);
        out[at] = bestFilter;
        out.set(best, at + 1);
    }
    return out;
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

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
