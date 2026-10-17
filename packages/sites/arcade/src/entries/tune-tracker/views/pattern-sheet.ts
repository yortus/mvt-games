import { AUDIO90_CELL_TEXT_WIDTH, type Audio90Song, formatAudio90Cell } from '@mvtjs/audio';
import { DOT_GLYPH, RULE_GLYPH } from './pixel-font';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A song's patterns laid out as a tracker shows them, one line a row: the
 * row's number in hex, then each channel's cell between rules. Each cell is
 * the text `formatAudio90Cell` gives, with a dot for each blank column, so
 * what is drawn is what the chip plays. A line is glyph codes, with an ink
 * for each, so the pattern view draws a row by copying them, and allocates
 * nothing as the song plays.
 */
export interface PatternSheet {
    readonly song: Audio90Song;
    /** How many characters each line has. */
    readonly width: number;
    /** Where each channel's cell starts in a line, in characters. */
    readonly channelColumns: readonly number[];
    /** How many characters each channel's cell has. */
    readonly channelWidths: readonly number[];
    /** Each pattern's lines, in the order of `song.patterns`: `width` glyph codes a line, row by row. */
    readonly glyphs: readonly Uint8Array[];
    /** The ink of each glyph in `glyphs`, one of the `INK_*` numbers. */
    readonly inks: readonly Uint8Array[];
}

// Each glyph's ink: what it shows, which the pattern view colours
export const INK_BLANK = 0;
export const INK_DOT = 1;
export const INK_NOTE = 2;
export const INK_RELEASE = 3;
export const INK_INSTRUMENT = 4;
export const INK_VOLUME = 5;
export const INK_EFFECT = 6;
export const INK_RULE = 7;
/** A row's number, a row that starts a beat, and one that starts a bar of four beats. */
export const INK_ROW = 8;
export const INK_BEAT_ROW = 9;
export const INK_BAR_ROW = 10;
export const INK_COUNT = 11;

/** How many characters a line's row number and its rule take. */
export const ROW_NUMBER_WIDTH = 3;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PatternSheetOptions {
    readonly song: Audio90Song;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Lays out every pattern of `song`. Each channel's cell is wide enough for
 * the most effects any of its cells has, and for one at least, as a
 * tracker keeps a column for them. It runs once a song.
 */
export function createPatternSheet(options: PatternSheetOptions): PatternSheet {
    const { song } = options;
    const texts = song.patterns.map((pattern) => {
        const lines: string[][] = [];
        for (let row = 0; row < pattern.rowCount; row++) {
            const cells: string[] = [];
            for (let channel = 0; channel < song.channelCount; channel++) cells.push(formatAudio90Cell(song, pattern, row, channel));
            lines.push(cells);
        }
        return lines;
    });

    const effectColumns = new Array<number>(song.channelCount).fill(1);
    for (const lines of texts) {
        for (const cells of lines) {
            for (let channel = 0; channel < cells.length; channel++) {
                effectColumns[channel] = Math.max(effectColumns[channel], listEffects(cells[channel]).length);
            }
        }
    }
    const channelColumns: number[] = [];
    const channelWidths: number[] = [];
    let width = ROW_NUMBER_WIDTH;
    for (let channel = 0; channel < song.channelCount; channel++) {
        channelColumns.push(width);
        const cellWidth = AUDIO90_CELL_TEXT_WIDTH + effectColumns[channel] * EFFECT_WIDTH;
        channelWidths.push(cellWidth);
        width += cellWidth + 1;
    }

    const glyphs: Uint8Array[] = [];
    const inks: Uint8Array[] = [];
    for (const lines of texts) {
        const patternGlyphs = new Uint8Array(lines.length * width).fill(SPACE);
        const patternInks = new Uint8Array(lines.length * width);
        for (let row = 0; row < lines.length; row++) {
            const line = { glyphs: patternGlyphs, inks: patternInks, at: row * width };
            const rowInk = row % (song.rowsPerBeat * BEATS_A_BAR) === 0 ? INK_BAR_ROW : row % song.rowsPerBeat === 0 ? INK_BEAT_ROW : INK_ROW;
            put(line, 0, row.toString(16).toUpperCase().padStart(2, '0'), rowInk);
            putGlyph(line, 2, RULE_GLYPH, INK_RULE);
            for (let channel = 0; channel < song.channelCount; channel++) {
                const column = channelColumns[channel];
                putCell(line, column, lines[row][channel], effectColumns[channel]);
                putGlyph(line, column + channelWidths[channel], RULE_GLYPH, INK_RULE);
            }
        }
        glyphs.push(patternGlyphs);
        inks.push(patternInks);
    }
    return { song, width, channelColumns, channelWidths, glyphs, inks };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One line of a pattern being laid out: the arrays it is written into, and where it starts in them. */
interface SheetLine {
    readonly glyphs: Uint8Array;
    readonly inks: Uint8Array;
    readonly at: number;
}

const SPACE = 32;
const BEATS_A_BAR = 4;
/** Each effect column: a space, then three characters, as `P40` takes. */
const EFFECT_WIDTH = 4;
const EFFECT_TOKEN_WIDTH = 3;

/** A cell's effect tokens: the words after its note, instrument and volume. */
function listEffects(text: string): string[] {
    const rest = text.slice(AUDIO90_CELL_TEXT_WIDTH).trim();
    return rest === '' ? [] : rest.split(' ');
}

/** Writes a cell's text at `column`: its note, instrument and volume as they are, and its effects in their columns, with a dot for each blank. */
function putCell(line: SheetLine, column: number, text: string, effectColumns: number): void {
    const note = text.slice(0, 3);
    if (note === '...') putDots(line, column, 3);
    else put(line, column, note, note === '===' ? INK_RELEASE : INK_NOTE);
    const letter = text.charAt(4);
    if (letter === ' ') putDots(line, column + 4, 1);
    else put(line, column + 4, letter, INK_INSTRUMENT);
    const volume = text.slice(6, 8);
    if (volume === '  ') putDots(line, column + 6, 2);
    else put(line, column + 6, volume, INK_VOLUME);
    const effects = listEffects(text);
    for (let i = 0; i < effectColumns; i++) {
        const at = column + AUDIO90_CELL_TEXT_WIDTH + i * EFFECT_WIDTH + 1;
        if (i < effects.length) put(line, at, effects[i], INK_EFFECT);
        else putDots(line, at, EFFECT_TOKEN_WIDTH);
    }
}

function put(line: SheetLine, column: number, text: string, ink: number): void {
    for (let i = 0; i < text.length; i++) putGlyph(line, column + i, text.charCodeAt(i), ink);
}

function putDots(line: SheetLine, column: number, count: number): void {
    for (let i = 0; i < count; i++) putGlyph(line, column + i, DOT_GLYPH, INK_DOT);
}

function putGlyph(line: SheetLine, column: number, code: number, ink: number): void {
    line.glyphs[line.at + column] = code;
    line.inks[line.at + column] = ink;
}
