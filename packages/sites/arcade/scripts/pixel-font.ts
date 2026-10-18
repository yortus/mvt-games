import { deflateSync } from 'node:zlib';

// Builds a web font from the site's pixel glyphs, so a page can set its text
// in them with CSS alone: the nav of the Arcade, the docs and the playground.
// Each filled cell is a square, so the font has no curves. It is a TrueType
// font, written table by table, then wrapped as WOFF, which every browser
// reads. The build is the same every time, so a test can check the font
// committed is the one the glyphs make.

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `buildPixelFont` makes a font from. */
export interface PixelFontOptions {
    /** The font's name, as CSS's `font-family` would give it. */
    readonly familyName: string;
    /** The glyphs, by character code from `firstCode`: rows of cells, `#` filled, from the top. */
    readonly glyphs: readonly (readonly string[])[];
    /** The character code of the first glyph. */
    readonly firstCode: number;
    /** How many cells wide every glyph is. The font is monospace, with a cell's gap after each glyph. */
    readonly columns: number;
    /** How many rows a capital takes, from its top to the baseline. The em is this many cells, so `font-size` is a capital's height. */
    readonly baselineRows: number;
    /** How many rows the tallest glyph takes, its descender included. */
    readonly rows: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Builds a TrueType font of `options.glyphs`, each cell a square. */
export function buildPixelFont(options: PixelFontOptions): Uint8Array {
    const { glyphs, firstCode, columns, baselineRows, rows } = options;
    const unitsPerEm = baselineRows * CELL;
    const ascent = baselineRows * CELL;
    const descent = (rows - baselineRows) * CELL;
    const advance = (columns + 1) * CELL;
    const lastCode = firstCode + glyphs.length - 1;

    // Glyph 0 is .notdef, which draws nothing. Then one for each character
    const outlines: Outline[] = [{ boxes: [] }];
    for (let i = 0; i < glyphs.length; i++) outlines.push({ boxes: boxesOf(glyphs[i], baselineRows) });

    const glyf = createWriter();
    const offsets: number[] = [];
    let maxPoints = 0;
    let maxContours = 0;
    const bounds = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
    for (const outline of outlines) {
        offsets.push(glyf.length);
        if (outline.boxes.length === 0) continue;
        writeGlyph(glyf, outline, bounds);
        maxPoints = Math.max(maxPoints, outline.boxes.length * 4);
        maxContours = Math.max(maxContours, outline.boxes.length);
    }
    offsets.push(glyf.length);
    const numGlyphs = outlines.length;

    const loca = createWriter();
    for (const offset of offsets) loca.u32(offset);

    const head = createWriter();
    head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5F0F3CF5);
    // Flags: the baseline at y 0, the left side bearing at x 0
    head.u16(0x0003).u16(unitsPerEm);
    head.u32(0).u32(0).u32(0).u32(0);
    head.i16(bounds.xMin).i16(bounds.yMin).i16(bounds.xMax).i16(bounds.yMax);
    head.u16(0).u16(7).i16(2).i16(1).i16(0);

    const hhea = createWriter();
    hhea.u32(0x00010000).i16(ascent).i16(-descent).i16(0).u16(advance);
    hhea.i16(0).i16(advance - bounds.xMax).i16(bounds.xMax);
    hhea.i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs);

    const maxp = createWriter();
    maxp.u32(0x00010000).u16(numGlyphs).u16(maxPoints).u16(maxContours).u16(0).u16(0);
    maxp.u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

    const hmtx = createWriter();
    for (const outline of outlines) hmtx.u16(advance).i16(outline.boxes.length === 0 ? 0 : leftOf(outline));

    const xHeight = topOf(glyphs['x'.charCodeAt(0) - firstCode] ?? [], baselineRows);
    const os2 = createWriter();
    os2.u16(4).i16(advance).u16(400).u16(5).u16(0);
    // Subscript and superscript sizes and offsets, then the strikeout's
    os2.i16(unitsPerEm * 0.65).i16(unitsPerEm * 0.6).i16(0).i16(unitsPerEm * 0.075);
    os2.i16(unitsPerEm * 0.65).i16(unitsPerEm * 0.6).i16(0).i16(unitsPerEm * 0.35);
    os2.i16(CELL).i16(Math.round(xHeight / 2 / CELL) * CELL).i16(0);
    // PANOSE: monospaced
    os2.bytes([2, 0, 5, 9, 0, 0, 0, 0, 0, 0]);
    // Basic Latin, then the vendor, then a regular weight
    os2.u32(1).u32(0).u32(0).u32(0).bytes([...'NONE'].map((c) => c.charCodeAt(0))).u16(0x0040);
    os2.u16(firstCode).u16(lastCode);
    os2.i16(ascent).i16(-descent).i16(0).u16(ascent).u16(descent);
    // Latin 1, the x-height, the cap height, then the default and break characters
    os2.u32(1).u32(0).i16(xHeight).i16(ascent).u16(0).u16(32).u16(1);

    const cmap = createWriter();
    cmap.u16(0).u16(1).u16(3).u16(1).u32(12);
    // Format 4: one segment for the glyphs, and the one that ends every table
    cmap.u16(4).u16(32).u16(0).u16(4).u16(4).u16(1).u16(0);
    cmap.u16(lastCode).u16(0xFFFF).u16(0).u16(firstCode).u16(0xFFFF);
    cmap.u16((1 - firstCode) & 0xFFFF).u16(1).u16(0).u16(0);

    const name = nameTable(options.familyName);

    const post = createWriter();
    post.u32(0x00030000).u32(0).i16(-CELL).i16(CELL).u32(1).u32(0).u32(0).u32(0).u32(0);

    return writeSfnt([
        ['OS/2', os2], ['cmap', cmap], ['glyf', glyf], ['head', head], ['hhea', hhea],
        ['hmtx', hmtx], ['loca', loca], ['maxp', maxp], ['name', name], ['post', post],
    ]);
}

/** Wraps a TrueType font as WOFF, each table compressed where that makes it smaller. */
export function toWoff(font: Uint8Array): Uint8Array {
    const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
    const numTables = view.getUint16(4);
    const tables: { tag: number; checksum: number; data: Uint8Array; packed: Uint8Array }[] = [];
    for (let i = 0; i < numTables; i++) {
        const entry = 12 + i * 16;
        const offset = view.getUint32(entry + 8);
        const length = view.getUint32(entry + 12);
        const data = font.subarray(offset, offset + length);
        const deflated = deflateSync(data, { level: 9 });
        tables.push({ tag: view.getUint32(entry), checksum: view.getUint32(entry + 4), data, packed: deflated.length < length ? deflated : data });
    }
    const out = createWriter();
    const headerLength = 44 + numTables * 20;
    let offset = headerLength;
    const placed: number[] = [];
    for (const table of tables) {
        placed.push(offset);
        offset += padded(table.packed.length);
    }
    out.u32(0x774F4646).u32(0x00010000).u32(offset).u16(numTables).u16(0).u32(font.length);
    out.u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        out.u32(table.tag).u32(placed[i]).u32(table.packed.length).u32(table.data.length).u32(table.checksum);
    }
    for (const table of tables) out.bytes(table.packed).pad();
    return out.toBytes();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A cell's size, in font units. */
const CELL = 100;

/** A rectangle of filled cells, in font units, y up from the baseline. */
interface Box {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
}

interface Outline {
    readonly boxes: readonly Box[];
}

/**
 * The filled cells of `glyph` as rectangles: the runs along each row, with
 * a run joined to the one above it where they line up, so a stroke is one
 * shape rather than a stack of them.
 */
function boxesOf(glyph: readonly string[], baselineRows: number): Box[] {
    // Open rectangles in cells: their left, width, top row and bottom row
    const shapes: { x: number; width: number; top: number; bottom: number }[] = [];
    for (let y = 0; y < glyph.length; y++) {
        const row = glyph[y];
        let start = -1;
        for (let x = 0; x <= row.length; x++) {
            const isFilled = x < row.length && row[x] === '#';
            if (isFilled && start < 0) start = x;
            if (isFilled || start < 0) continue;
            const width = x - start;
            const above = shapes.find((s) => s.x === start && s.width === width && s.bottom === y - 1);
            if (above === undefined) shapes.push({ x: start, width, top: y, bottom: y });
            else above.bottom = y;
            start = -1;
        }
    }
    return shapes.map((s) => ({
        x0: s.x * CELL,
        x1: (s.x + s.width) * CELL,
        y0: (baselineRows - 1 - s.bottom) * CELL,
        y1: (baselineRows - s.top) * CELL,
    }));
}

/** How far above the baseline `glyph`'s top is, in font units. */
function topOf(glyph: readonly string[], baselineRows: number): number {
    const first = glyph.findIndex((row) => row.includes('#'));
    return first < 0 ? 0 : (baselineRows - first) * CELL;
}

function leftOf(outline: Outline): number {
    return Math.min(...outline.boxes.map((b) => b.x0));
}

/** Writes a glyph of rectangles, each a contour drawn clockwise, with every point on the curve. */
function writeGlyph(glyf: Writer, outline: Outline, bounds: { xMin: number; yMin: number; xMax: number; yMax: number }): void {
    const { boxes } = outline;
    const xMin = Math.min(...boxes.map((b) => b.x0));
    const yMin = Math.min(...boxes.map((b) => b.y0));
    const xMax = Math.max(...boxes.map((b) => b.x1));
    const yMax = Math.max(...boxes.map((b) => b.y1));
    bounds.xMin = Math.min(bounds.xMin, xMin);
    bounds.yMin = Math.min(bounds.yMin, yMin);
    bounds.xMax = Math.max(bounds.xMax, xMax);
    bounds.yMax = Math.max(bounds.yMax, yMax);
    glyf.i16(boxes.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
    for (let i = 0; i < boxes.length; i++) glyf.u16(i * 4 + 3);
    glyf.u16(0);
    // Top left, top right, bottom right, bottom left: clockwise, as TrueType fills
    const points: (readonly [number, number])[] = [];
    for (const b of boxes) points.push([b.x0, b.y1], [b.x1, b.y1], [b.x1, b.y0], [b.x0, b.y0]);
    for (let i = 0; i < points.length; i++) glyf.u8(0x01);
    let x = 0;
    for (const [px] of points) {
        glyf.i16(px - x);
        x = px;
    }
    let y = 0;
    for (const [, py] of points) {
        glyf.i16(py - y);
        y = py;
    }
    glyf.pad();
}

/** The names a font gives itself, for Windows, in UTF-16. */
function nameTable(familyName: string): Writer {
    const postScriptName = `${familyName.replace(/[^A-Za-z0-9]/g, '')}-Regular`;
    const names: (readonly [number, string])[] = [
        [1, familyName],
        [2, 'Regular'],
        [3, postScriptName],
        [4, familyName],
        [5, 'Version 1.0'],
        [6, postScriptName],
    ];
    const strings = createWriter();
    const table = createWriter();
    table.u16(0).u16(names.length).u16(6 + names.length * 12);
    for (const [id, text] of names) {
        const start = strings.length;
        for (let i = 0; i < text.length; i++) strings.u16(text.charCodeAt(i));
        table.u16(3).u16(1).u16(0x0409).u16(id).u16(strings.length - start).u16(start);
    }
    table.bytes(strings.toBytes());
    return table;
}

/**
 * Writes the font: its table directory, then each table, four-byte aligned,
 * with its checksum. The checksum of the whole is set in `head` last.
 */
function writeSfnt(tables: readonly (readonly [string, Writer])[]): Uint8Array {
    const count = tables.length;
    const power = 2 ** Math.floor(Math.log2(count));
    const out = createWriter();
    out.u32(0x00010000).u16(count).u16(power * 16).u16(Math.log2(power)).u16(count * 16 - power * 16);
    let offset = 12 + count * 16;
    const datas = tables.map(([, w]) => w.toBytes());
    for (let i = 0; i < count; i++) {
        const tag = tables[i][0];
        out.bytes([...tag].map((c) => c.charCodeAt(0))).u32(checksumOf(datas[i])).u32(offset).u32(datas[i].length);
        offset += padded(datas[i].length);
    }
    for (const data of datas) out.bytes(data).pad();
    const font = out.toBytes();
    // The whole font's checksum, folded into `head` so the whole sums to a magic number
    const headIndex = tables.findIndex(([tag]) => tag === 'head');
    const headOffset = new DataView(font.buffer).getUint32(12 + headIndex * 16 + 8);
    new DataView(font.buffer).setUint32(headOffset + 8, (0xB1B0AFBA - checksumOf(font)) >>> 0);
    return font;
}

/** A table's checksum: the sum of its four-byte words, the last padded with zeros. */
function checksumOf(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const word = ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0;
        sum = (sum + word) >>> 0;
    }
    return sum;
}

function padded(length: number): number {
    return (length + 3) & ~3;
}

/** Writes big-endian values into a growing buffer. Each write returns the writer, so writes chain. */
interface Writer {
    readonly length: number;
    readonly u8: (value: number) => Writer;
    readonly u16: (value: number) => Writer;
    readonly i16: (value: number) => Writer;
    readonly u32: (value: number) => Writer;
    readonly bytes: (values: ArrayLike<number>) => Writer;
    /** Pads with zeros to a whole number of four-byte words. */
    readonly pad: () => Writer;
    readonly toBytes: () => Uint8Array;
}

function createWriter(): Writer {
    const chunks: number[] = [];
    const writer: Writer = {
        get length() {
            return chunks.length;
        },
        u8(value) {
            chunks.push(value & 0xFF);
            return writer;
        },
        u16(value) {
            return writer.u8(value >> 8).u8(value);
        },
        i16(value) {
            return writer.u16(Math.round(value) & 0xFFFF);
        },
        u32(value) {
            return writer.u16(value >>> 16).u16(value & 0xFFFF);
        },
        bytes(values) {
            for (let i = 0; i < values.length; i++) chunks.push(values[i]);
            return writer;
        },
        pad() {
            while (chunks.length % 4 !== 0) chunks.push(0);
            return writer;
        },
        toBytes() {
            return Uint8Array.from(chunks);
        },
    };
    return writer;
}
