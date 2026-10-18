import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PIXEL_FONT_OPTIONS } from './pixel-font-options.ts';
import { buildPixelFont, toWoff } from './pixel-font.ts';

describe('buildPixelFont', () => {
    const font = buildPixelFont(PIXEL_FONT_OPTIONS);
    const view = new DataView(font.buffer);

    it('sums to the magic number TrueType asks for, with each table\'s checksum right', () => {
        expect(checksumOf(font)).toBe(0xB1B0AFBA);
        for (const { tag, offset, length, checksum } of tablesOf(font)) {
            const data = font.slice(offset, offset + length);
            // `head` is summed with its whole-font adjustment as zero
            if (tag === 'head') new DataView(data.buffer).setUint32(8, 0);
            expect(checksumOf(data), tag).toBe(checksum);
        }
    });

    it('maps each character to its glyph, one after .notdef', () => {
        const cmap = tableOf(font, 'cmap');
        const sub = cmap.offset + view.getUint32(cmap.offset + 8);
        const start = view.getUint16(sub + 14 + 2 * 2 + 2);
        const delta = view.getUint16(sub + 14 + 4 * 2 + 2);
        const code = 'A'.charCodeAt(0);
        expect(start).toBe(PIXEL_FONT_OPTIONS.firstCode);
        expect((code + delta) & 0xFFFF).toBe(code - PIXEL_FONT_OPTIONS.firstCode + 1);
    });

    it('draws a glyph as rectangles of cells, a capital filling the em from the baseline', () => {
        const em = PIXEL_FONT_OPTIONS.baselineRows * 100;
        expect(view.getUint16(tableOf(font, 'head').offset + 18)).toBe(em);
        const glyph = glyphAt(font, 'I'.charCodeAt(0) - PIXEL_FONT_OPTIONS.firstCode + 1);
        expect(glyph.yMin).toBe(0);
        expect(glyph.yMax).toBe(em);
        // Every contour is a rectangle, of four points
        expect(glyph.pointCount).toBe(glyph.contourCount * 4);
    });

    it('is the font committed, so the nav shows the glyphs as they are', () => {
        const committed = readFileSync(join(import.meta.dirname, '..', 'src', 'shared', 'mvt-pixel.woff'));
        // If this fails, run `npm run generate-pixel-font -w @mvtjs/arcade`
        expect(Buffer.from(toWoff(font)).equals(committed)).toBe(true);
    });
});

describe('toWoff', () => {
    it('holds every table of the font, which unpacks to the same bytes', () => {
        const font = buildPixelFont(PIXEL_FONT_OPTIONS);
        const woff = toWoff(font);
        const view = new DataView(woff.buffer);
        expect(view.getUint32(0)).toBe(0x774F4646);
        expect(view.getUint32(8)).toBe(woff.length);
        const tables = tablesOf(font);
        expect(view.getUint16(12)).toBe(tables.length);
        for (let i = 0; i < tables.length; i++) {
            const entry = 44 + i * 20;
            const offset = view.getUint32(entry + 4);
            const packedLength = view.getUint32(entry + 8);
            const length = view.getUint32(entry + 12);
            const packed = woff.subarray(offset, offset + packedLength);
            const data = packedLength < length ? inflateSync(packed) : packed;
            const original = font.subarray(tables[i].offset, tables[i].offset + tables[i].length);
            expect(Buffer.from(data).equals(Buffer.from(original)), tables[i].tag).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TableEntry {
    readonly tag: string;
    readonly checksum: number;
    readonly offset: number;
    readonly length: number;
}

function tablesOf(font: Uint8Array): TableEntry[] {
    const view = new DataView(font.buffer, font.byteOffset);
    const tables: TableEntry[] = [];
    for (let i = 0; i < view.getUint16(4); i++) {
        const entry = 12 + i * 16;
        tables.push({
            tag: String.fromCharCode(...font.subarray(entry, entry + 4)),
            checksum: view.getUint32(entry + 4),
            offset: view.getUint32(entry + 8),
            length: view.getUint32(entry + 12),
        });
    }
    return tables;
}

function tableOf(font: Uint8Array, tag: string): TableEntry {
    const table = tablesOf(font).find((t) => t.tag === tag);
    if (table === undefined) throw new Error(`no ${tag} table`);
    return table;
}

/** A glyph's bounds, and how many contours and points it has. */
function glyphAt(font: Uint8Array, index: number): { yMin: number; yMax: number; contourCount: number; pointCount: number } {
    const view = new DataView(font.buffer);
    const loca = tableOf(font, 'loca');
    const at = tableOf(font, 'glyf').offset + view.getUint32(loca.offset + index * 4);
    const contourCount = view.getInt16(at);
    return {
        yMin: view.getInt16(at + 4),
        yMax: view.getInt16(at + 8),
        contourCount,
        pointCount: view.getUint16(at + 10 + (contourCount - 1) * 2) + 1,
    };
}

function checksumOf(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const word = ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0;
        sum = (sum + word) >>> 0;
    }
    return sum;
}
