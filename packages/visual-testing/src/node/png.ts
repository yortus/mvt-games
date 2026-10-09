/**
 * Reads and writes reference pictures as PNG files. Each file carries the
 * hash of its pixels in a text chunk right after the PNG header. So a test
 * run can read every reference's hash from the first hundred or so bytes of
 * its file, without decoding the picture.
 */

import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A picture's pixels, as RGBA with 8 bits for each channel, in rows from the top. */
export interface Picture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the hash a picture is known by. It holds the picture's size and
 * the first 32 hex digits of the SHA-256 hash of its pixels. The test page
 * computes the same hash, in `src/browser/judge.ts`.
 */
export function hashPicture(picture: Picture): string {
    return `${picture.width}x${picture.height}:${createHash('sha256').update(picture.pixels).digest('hex').slice(0, 32)}`;
}

/**
 * Returns the PNG file for a picture, with the picture's hash in a `tEXt`
 * chunk after the header. The encoding is lossless, and as small as a
 * simple encoder can make it. It takes one of these forms:
 *
 * - A picture of 256 colours or fewer, as flat art and pixel art usually
 *   are, gets a palette with 1, 2, 4 or 8 bits for each pixel.
 * - Otherwise, an opaque picture is stored as RGB, and any other picture
 *   as RGBA. Every picture here is opaque. Each row uses whichever of PNG's
 *   five filters suits it best.
 *
 * The same pixels always give the same bytes with the same version of Node.
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
        extra.push(encodeChunk('PLTE', indexed.palette));
        if (indexed.alphas !== undefined) extra.push(encodeChunk('tRNS', indexed.alphas));
        // Palette rows are left unfiltered, as the PNG specification advises.
        rows = prefixEmptyFilters(indexed.rows, Math.ceil((width * bitDepth) / 8), height);
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
    // The compression, filter method and interlace bytes stay 0.
    return concat([
        SIGNATURE,
        encodeChunk('IHDR', header),
        encodeChunk('tEXt', text),
        ...extra,
        encodeChunk('IDAT', deflateSync(rows, { level: 9 })),
        encodeChunk('IEND', new Uint8Array(0)),
    ]);
}

/** Decodes any PNG file and returns its pixels. */
export function decodePng(bytes: Uint8Array): Picture {
    const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return { width: png.width, height: png.height, pixels: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
}

/**
 * Returns the hash that a reference file carries, read from the file's
 * first bytes. Returns undefined if the file carries no hash, as with a PNG
 * that `encodePng` did not write.
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
    // The file starts with the signature (8 bytes) and the IHDR chunk (25
    // bytes). The text chunk follows. It holds its length, its type, the
    // keyword, a NUL byte and the text.
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
    /** Each colour's alpha, or undefined if every colour is opaque. */
    readonly alphas: Uint8Array | undefined;
    /** Each row's indices, packed at the bit depth, unfiltered. */
    readonly rows: Uint8Array;
}

/** Returns the picture as palette indices, or undefined if it has more than 256 colours. */
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

/** Returns the rows, each with filter byte 0 (no filter) in front. */
function prefixEmptyFilters(data: Uint8Array, rowBytes: number, height: number): Uint8Array {
    const out = new Uint8Array((rowBytes + 1) * height);
    for (let y = 0; y < height; y++) out.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
    return out;
}

/**
 * Returns the rows, each filtered with the filter (none, sub, up, average
 * or Paeth) whose output has the smallest sum of absolute values. This is
 * the usual heuristic for which filter compresses best.
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
                const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : predictPaeth(a, b, c);
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

function predictPaeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encodeChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, computeCrc32(out.subarray(4, 8 + data.length)));
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

function computeCrc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
