/**
 * The blank font: a TrueType font in which every code point is one empty
 * glyph, 0.6 em wide, with fixed vertical metrics. HTML text in a visual
 * test is set in it, so it keeps its layout and draws nothing: the systems
 * draw text differently, and nothing else made them agree.
 *
 * TrueType, not CFF2: Windows lays a TrueType web font out with DirectWrite
 * and macOS with Core Text, which keep each advance's exact fraction, and
 * agree to 1/64 pixel; with `--font-render-hinting=none`, Linux (Chrome's
 * own engine) does too. Chrome's engine rounds a CFF2 font's advances to
 * whole pixels on Windows and Linux, and macOS does not.
 *
 * Every code point maps to the glyph: a format 4 subtable for U+0020 to
 * U+2FFF (its offsets cannot reach further), and a format 13 subtable
 * (many-to-one ranges) for every code point. So no character falls back to
 * a system font, emoji and CJK included.
 *
 * Written by hand, table by table, to the OpenType specification, as small
 * as a font can be. Its tables mirror the font the spike measured, which
 * was built with fontTools.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BlankFontOptions {
    /** The family name the font declares. CSS names it in `@font-face` anyway. */
    readonly family: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** The font's file, as bytes. */
export function buildBlankFont(options: BlankFontOptions): Uint8Array {
    const tables: [string, Uint8Array][] = [
        ['DSIG', dsig()],
        ['OS/2', os2()],
        ['cmap', cmap()],
        ['glyf', new Uint8Array(1)],
        ['head', head()],
        ['hhea', hhea()],
        ['hmtx', hmtx()],
        ['loca', new Uint8Array(2 * (GLYPH_COUNT + 1))],
        ['maxp', maxp()],
        ['name', name(options.family)],
        ['post', post()],
    ];
    return assemble(tables);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const UNITS_PER_EM = 1000;
const ADVANCE = 600;
const ASCENT = 800;
const DESCENT = 200;
/** `.notdef` and the one glyph every code point maps to. */
const GLYPH_COUNT = 2;
const BLANK_GLYPH = 1;
/** The last code point the format 4 subtable maps. */
const FORMAT_4_LAST = 0x2fff;
const FIRST_CHAR = 0x20;

/** A growable big-endian byte writer. */
interface Writer {
    u8: (value: number) => Writer;
    u16: (value: number) => Writer;
    i16: (value: number) => Writer;
    u32: (value: number) => Writer;
    bytes: (value: Uint8Array) => Writer;
    tag: (value: string) => Writer;
    finish: () => Uint8Array;
}

function writer(): Writer {
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

/** An empty digital signature table, as fontTools writes for TrueType fonts. */
function dsig(): Uint8Array {
    return writer().u32(1).u16(0).u16(0).finish();
}

function os2(): Uint8Array {
    return writer()
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

function cmap(): Uint8Array {
    const format4 = cmapFormat4();
    const format13 = cmapFormat13();
    const headerSize = 4 + 2 * 8;
    return writer()
        .u16(0).u16(2) // version, numTables
        .u16(3).u16(1).u32(headerSize) // Windows, Unicode BMP: format 4
        .u16(3).u16(10).u32(headerSize + format4.length) // Windows, Unicode full: format 13
        .bytes(format4)
        .bytes(format13)
        .finish();
}

/**
 * U+0020 to U+2FFF, every one to the blank glyph, through `glyphIdArray`
 * (one entry per code point), and the 0xFFFF segment the format requires.
 */
function cmapFormat4(): Uint8Array {
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
    const w = writer()
        .u16(4).u16(length).u16(0) // format, length, language
        .u16(segCount * 2).u16(searchRange).u16(entrySelector).u16(segCount * 2 - searchRange)
        .u16(FORMAT_4_LAST).u16(0xffff) // endCode
        .u16(0) // reservedPad
        .u16(FIRST_CHAR).u16(0xffff) // startCode
        .i16(0).i16(1) // idDelta
        .u16(segCount * 2).u16(0); // idRangeOffset: the first segment's glyphIdArray starts right after
    for (let i = 0; i < count; i++) w.u16(BLANK_GLYPH);
    return w.finish();
}

/** Every code point but the surrogates, to the blank glyph, in two groups. */
function cmapFormat13(): Uint8Array {
    const groups: [number, number][] = [[FIRST_CHAR, 0xd7ff], [0xe000, 0x10ffff]];
    const w = writer()
        .u16(13).u16(0) // format, reserved
        .u32(16 + groups.length * 12) // length
        .u32(0) // language
        .u32(groups.length);
    for (const [start, end] of groups) w.u32(start).u32(end).u32(BLANK_GLYPH);
    return w.finish();
}

function head(): Uint8Array {
    return writer()
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

function hhea(): Uint8Array {
    return writer()
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

/** One advance and left side bearing, then the other glyph's left side bearing. */
function hmtx(): Uint8Array {
    const w = writer().u16(ADVANCE).i16(0);
    for (let i = 1; i < GLYPH_COUNT; i++) w.i16(0);
    return w.finish();
}

function maxp(): Uint8Array {
    return writer()
        .u32(0x00010000)
        .u16(GLYPH_COUNT)
        .u16(0).u16(0).u16(0).u16(0) // maxPoints, maxContours, maxCompositePoints, maxCompositeContours
        .u16(2) // maxZones
        .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0) // twilight points to component depth
        .finish();
}

/** Family and subfamily names, for Macintosh (Roman) and Windows (Unicode, US English). */
function name(family: string): Uint8Array {
    const records: { platform: number; encoding: number; language: number; id: number; bytes: Uint8Array }[] = [];
    for (const [id, value] of [[1, family], [2, 'Regular']] as const) {
        records.push({ platform: 1, encoding: 0, language: 0, id, bytes: Uint8Array.from(value, (c) => c.charCodeAt(0)) });
    }
    for (const [id, value] of [[1, family], [2, 'Regular']] as const) {
        const utf16 = writer();
        for (let i = 0; i < value.length; i++) utf16.u16(value.charCodeAt(i));
        records.push({ platform: 3, encoding: 1, language: 0x409, id, bytes: utf16.finish() });
    }
    const w = writer().u16(0).u16(records.length).u16(6 + records.length * 12);
    let offset = 0;
    for (const r of records) {
        w.u16(r.platform).u16(r.encoding).u16(r.language).u16(r.id).u16(r.bytes.length).u16(offset);
        offset += r.bytes.length;
    }
    for (const r of records) w.bytes(r.bytes);
    return w.finish();
}

/** Version 2, naming `.notdef` and `g` by their indices among the standard Macintosh glyph names. */
function post(): Uint8Array {
    return writer()
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

/** The table directory, the tables (each padded to four bytes), and the whole font's checksum in `head`. */
function assemble(tables: [string, Uint8Array][]): Uint8Array {
    const sorted = [...tables].sort(([a], [b]) => (a < b ? -1 : 1));
    let searchRange = 1;
    let entrySelector = 0;
    while (searchRange * 2 <= sorted.length) {
        searchRange *= 2;
        entrySelector++;
    }
    searchRange *= 16;
    const directory = writer()
        .u32(0x00010000)
        .u16(sorted.length).u16(searchRange).u16(entrySelector).u16(sorted.length * 16 - searchRange);
    let offset = 12 + sorted.length * 16;
    const body = writer();
    let headOffset = 0;
    for (const [tag, data] of sorted) {
        if (tag === 'head') headOffset = offset;
        directory.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
        const padded = new Uint8Array((data.length + 3) & ~3);
        padded.set(data);
        body.bytes(padded);
        offset += padded.length;
    }
    const font = new Uint8Array([...directory.finish(), ...body.finish()]);
    const adjustment = (0xb1b0afba - checksum(font)) >>> 0;
    new DataView(font.buffer).setUint32(headOffset + 8, adjustment);
    return font;
}

function checksum(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const word = ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0;
        sum = (sum + word) >>> 0;
    }
    return sum;
}
