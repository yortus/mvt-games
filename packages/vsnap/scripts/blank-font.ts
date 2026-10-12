/**
 * The blank font is a TrueType font in which every code point maps to one
 * empty glyph. The glyph is 0.625 em wide, and the font's vertical metrics
 * are fixed. HTML text in a visual test is set in this font, so the text
 * keeps its layout but draws nothing. Each operating system draws text
 * differently, and nothing else made them agree.
 *
 * The font is TrueType, not CFF2 (the other OpenType outline format).
 * Windows lays out a TrueType web font with DirectWrite, and macOS lays it
 * out with Core Text. Both keep the exact fraction of each advance (the
 * distance from one glyph to the next), and they agree to 1/64 pixel. With
 * `--font-render-hinting=none`, Linux, which uses Chrome's own text engine,
 * agrees too. Chrome's engine rounds a CFF2 font's advances to whole pixels
 * on Windows and Linux, but macOS does not.
 *
 * The font has 1024 units per em, a power of two. Linux scales a font in
 * 64ths of a pixel. With any other number of units, its advances come out
 * a 64th or two off the other systems' advances at most font sizes. That
 * is enough to move a box's edge by a pixel. With 1024, all three systems
 * agree exactly at every font size that is a whole number of quarter
 * pixels. The visual test harness rounds font sizes to quarter pixels.
 *
 * Every code point maps to the glyph through two subtables of the character
 * map (`cmap`). A format 4 subtable covers U+0020 to U+2FFF, because its
 * offsets cannot reach further. A format 13 subtable, which maps ranges of
 * code points to one glyph, covers every code point from U+0020 up. So no
 * character falls back to a system font, emoji and CJK included.
 *
 * The font is written by hand, table by table, to the OpenType
 * specification, and it is as small as a font can be. Its tables mirror
 * those of a font built with fontTools, which an earlier experiment
 * measured.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BlankFontOptions {
    /** The family name the font declares. CSS gives the font its own name in `@font-face`, so this one matters little. */
    readonly family: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Builds the blank font and returns its file as bytes. */
export function buildBlankFont(options: BlankFontOptions): Uint8Array {
    const tables: [string, Uint8Array][] = [
        ['DSIG', writeDsig()],
        ['OS/2', writeOs2()],
        ['cmap', writeCmap()],
        ['glyf', new Uint8Array(1)],
        ['head', writeHead()],
        ['hhea', writeHhea()],
        ['hmtx', writeHmtx()],
        ['loca', new Uint8Array(2 * (GLYPH_COUNT + 1))],
        ['maxp', writeMaxp()],
        ['name', writeName(options.family)],
        ['post', writePost()],
    ];
    return assemble(tables);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const UNITS_PER_EM = 1024;
const ADVANCE = 640;
const ASCENT = 820;
const DESCENT = 204;
/** The number of glyphs. They are `.notdef` and the one glyph that every code point maps to. */
const GLYPH_COUNT = 2;
const BLANK_GLYPH = 1;
/** The last code point the format 4 subtable maps. */
const FORMAT_4_LAST = 0x2fff;
const FIRST_CHAR = 0x20;

/** Writes big-endian values into a list of bytes that grows as needed. */
interface Writer {
    u8: (value: number) => Writer;
    u16: (value: number) => Writer;
    i16: (value: number) => Writer;
    u32: (value: number) => Writer;
    bytes: (value: Uint8Array) => Writer;
    tag: (value: string) => Writer;
    finish: () => Uint8Array;
}

function createWriter(): Writer {
    const out: number[] = [];
    const w: Writer = {
        u8: (value) => {
            out.push(value & 0xff);
            return w;
        },
        u16: (value) => w.u8(value >> 8).u8(value),
        i16: (value) => w.u16(value & 0xffff),
        u32: (value) => w.u16(Math.floor(value / 0x10000) & 0xffff).u16(value & 0xffff),
        bytes: (value) => {
            for (let i = 0; i < value.length; i++) out.push(value[i]);
            return w;
        },
        tag: (value) => {
            for (let i = 0; i < 4; i++) w.u8(value.charCodeAt(i));
            return w;
        },
        finish: () => Uint8Array.from(out),
    };
    return w;
}

/** Returns an empty digital signature table (`DSIG`), as fontTools writes for TrueType fonts. */
function writeDsig(): Uint8Array {
    return createWriter().u32(1).u16(0).u16(0).finish();
}

function writeOs2(): Uint8Array {
    return createWriter()
        .u16(4) // version
        .i16(ADVANCE) // xAvgCharWidth
        .u16(400) // usWeightClass
        .u16(5) // usWidthClass
        .u16(4) // fsType: preview and print embedding
        .i16(0).i16(0).i16(0).i16(0) // subscript size and offset
        .i16(0).i16(0).i16(0).i16(0) // superscript size and offset
        .i16(0).i16(0) // strikeout size and position
        .i16(0) // sFamilyClass
        .bytes(new Uint8Array(10)) // panose
        .u32(1).u32(0).u32(0).u32(0) // ulUnicodeRange1-4: Basic Latin
        .tag('????') // achVendID
        .u16(0x40 | 0x80) // fsSelection: REGULAR, USE_TYPO_METRICS
        .u16(FIRST_CHAR) // usFirstCharIndex
        .u16(0xffff) // usLastCharIndex
        .i16(ASCENT).i16(-DESCENT).i16(0) // sTypoAscender, sTypoDescender, sTypoLineGap
        .u16(ASCENT).u16(DESCENT) // usWinAscent, usWinDescent
        .u32(0).u32(0) // ulCodePageRange1-2
        .i16(500).i16(700) // sxHeight, sCapHeight
        .u16(0).u16(0x20).u16(0) // usDefaultChar, usBreakChar, usMaxContext
        .finish();
}

function writeCmap(): Uint8Array {
    const format4 = writeCmapFormat4();
    const format13 = writeCmapFormat13();
    const headerSize = 4 + 2 * 8;
    return createWriter()
        .u16(0).u16(2) // version, numTables
        .u16(3).u16(1).u32(headerSize) // Windows, Unicode BMP: format 4
        .u16(3).u16(10).u32(headerSize + format4.length) // Windows, Unicode full: format 13
        .bytes(format4)
        .bytes(format13)
        .finish();
}

/**
 * Returns a format 4 `cmap` subtable. It maps each code point from U+0020
 * to U+2FFF to the blank glyph through `glyphIdArray`, which has one entry
 * for each code point. It ends with the 0xFFFF segment that the format
 * requires.
 */
function writeCmapFormat4(): Uint8Array {
    const segCount = 2;
    const count = FORMAT_4_LAST - FIRST_CHAR + 1;
    const length = 16 + segCount * 8 + count * 2;
    let searchRange = 1;
    let entrySelector = 0;
    while (searchRange * 2 <= segCount) {
        searchRange *= 2;
        entrySelector++;
    }
    searchRange *= 2;
    const w = createWriter()
        .u16(4).u16(length).u16(0) // format, length, language
        .u16(segCount * 2).u16(searchRange).u16(entrySelector).u16(segCount * 2 - searchRange)
        .u16(FORMAT_4_LAST).u16(0xffff) // endCode
        .u16(0) // reservedPad
        .u16(FIRST_CHAR).u16(0xffff) // startCode
        .i16(0).i16(1) // idDelta
        .u16(segCount * 2).u16(0); // idRangeOffset: the first segment's glyphIdArray starts right after this array
    for (let i = 0; i < count; i++) w.u16(BLANK_GLYPH);
    return w.finish();
}

/**
 * Returns a format 13 `cmap` subtable. It maps every code point from U+0020
 * up, except the surrogates, to the blank glyph. It uses two groups, one on
 * each side of the surrogates.
 */
function writeCmapFormat13(): Uint8Array {
    const groups: [number, number][] = [[FIRST_CHAR, 0xd7ff], [0xe000, 0x10ffff]];
    const w = createWriter()
        .u16(13).u16(0) // format, reserved
        .u32(16 + groups.length * 12) // length
        .u32(0) // language
        .u32(groups.length);
    for (const [start, end] of groups) w.u32(start).u32(end).u32(BLANK_GLYPH);
    return w.finish();
}

function writeHead(): Uint8Array {
    return createWriter()
        .u32(0x00010000) // version
        .u32(0x00010000) // fontRevision 1.0
        .u32(0) // checkSumAdjustment, filled in by assemble()
        .u32(0x5f0f3cf5) // magicNumber
        .u16(3) // flags: baseline at y = 0, left sidebearing at x = 0
        .u16(UNITS_PER_EM)
        .u32(0).u32(0).u32(0).u32(0) // created, modified: fixed, so the bytes never change
        .i16(0).i16(0).i16(0).i16(0) // xMin, yMin, xMax, yMax
        .u16(0) // macStyle
        .u16(3) // lowestRecPPEM
        .i16(2) // fontDirectionHint
        .i16(0) // indexToLocFormat: short offsets
        .i16(0) // glyphDataFormat
        .finish();
}

function writeHhea(): Uint8Array {
    return createWriter()
        .u32(0x00010000)
        .i16(ASCENT).i16(-DESCENT).i16(0) // ascender, descender, lineGap
        .u16(ADVANCE) // advanceWidthMax
        .i16(0).i16(0).i16(0) // minLeftSideBearing, minRightSideBearing, xMaxExtent
        .i16(1).i16(0).i16(0) // caretSlopeRise, caretSlopeRun, caretOffset
        .i16(0).i16(0).i16(0).i16(0) // reserved
        .i16(0) // metricDataFormat
        .u16(1) // numberOfHMetrics: every glyph shares the one advance
        .finish();
}

/** Returns the horizontal metrics table (`hmtx`). It holds one advance and left side bearing, then the other glyph's left side bearing. */
function writeHmtx(): Uint8Array {
    const w = createWriter().u16(ADVANCE).i16(0);
    for (let i = 1; i < GLYPH_COUNT; i++) w.i16(0);
    return w.finish();
}

function writeMaxp(): Uint8Array {
    return createWriter()
        .u32(0x00010000)
        .u16(GLYPH_COUNT)
        .u16(0).u16(0).u16(0).u16(0) // maxPoints, maxContours, maxCompositePoints, maxCompositeContours
        .u16(2) // maxZones
        .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0) // maxTwilightPoints to maxComponentDepth
        .finish();
}

/** Returns the naming table (`name`). It holds the family and subfamily names for Macintosh (Roman) and for Windows (Unicode, US English). */
function writeName(family: string): Uint8Array {
    const records: { platform: number; encoding: number; language: number; id: number; bytes: Uint8Array }[] = [];
    for (const [id, value] of [[1, family], [2, 'Regular']] as const) {
        records.push({ platform: 1, encoding: 0, language: 0, id, bytes: Uint8Array.from(value, (c) => c.charCodeAt(0)) });
    }
    for (const [id, value] of [[1, family], [2, 'Regular']] as const) {
        const utf16 = createWriter();
        for (let i = 0; i < value.length; i++) utf16.u16(value.charCodeAt(i));
        records.push({ platform: 3, encoding: 1, language: 0x409, id, bytes: utf16.finish() });
    }
    const w = createWriter().u16(0).u16(records.length).u16(6 + records.length * 12);
    let offset = 0;
    for (const r of records) {
        w.u16(r.platform).u16(r.encoding).u16(r.language).u16(r.id).u16(r.bytes.length).u16(offset);
        offset += r.bytes.length;
    }
    for (const r of records) w.bytes(r.bytes);
    return w.finish();
}

/** Returns a version 2 PostScript table (`post`). It names the glyphs `.notdef` and `g` by their indices among the standard Macintosh glyph names. */
function writePost(): Uint8Array {
    return createWriter()
        .u32(0x00020000)
        .u32(0) // italicAngle
        .i16(0).i16(0) // underlinePosition, underlineThickness
        .u32(0) // isFixedPitch
        .u32(0).u32(0).u32(0).u32(0) // memory usage
        .u16(GLYPH_COUNT)
        .u16(0) // .notdef
        .u16(74) // g
        .finish();
}

/**
 * Returns the font file. It holds the table directory, then the tables,
 * each padded to four bytes. Last, it sets the checksum adjustment in
 * `head`, which is computed from the whole font's checksum.
 */
function assemble(tables: [string, Uint8Array][]): Uint8Array {
    const sorted = [...tables].sort(([a], [b]) => (a < b ? -1 : 1));
    let searchRange = 1;
    let entrySelector = 0;
    while (searchRange * 2 <= sorted.length) {
        searchRange *= 2;
        entrySelector++;
    }
    searchRange *= 16;
    const directory = createWriter()
        .u32(0x00010000)
        .u16(sorted.length).u16(searchRange).u16(entrySelector).u16(sorted.length * 16 - searchRange);
    let offset = 12 + sorted.length * 16;
    const body = createWriter();
    let headOffset = 0;
    for (const [tag, data] of sorted) {
        if (tag === 'head') headOffset = offset;
        directory.tag(tag).u32(computeChecksum(data)).u32(offset).u32(data.length);
        const padded = new Uint8Array((data.length + 3) & ~3);
        padded.set(data);
        body.bytes(padded);
        offset += padded.length;
    }
    const font = new Uint8Array([...directory.finish(), ...body.finish()]);
    const adjustment = (0xb1b0afba - computeChecksum(font)) >>> 0;
    new DataView(font.buffer).setUint32(headOffset + 8, adjustment);
    return font;
}

function computeChecksum(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const word = ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0;
        sum = (sum + word) >>> 0;
    }
    return sum;
}
