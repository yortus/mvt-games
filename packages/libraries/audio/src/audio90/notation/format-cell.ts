import { toNoteName } from '../../shared';
import {
    type Audio90Song,
    type Audio90SongPattern,
    CELL90_ACCENT,
    CELL90_ARPEGGIO,
    CELL90_BRIGHTNESS,
    CELL90_CHORD,
    CELL90_ECHO,
    CELL90_GLIDE,
    CELL90_INSTRUMENT,
    CELL90_IS_OWN_NOTE,
    CELL90_NOTE,
    CELL90_PAN,
    CELL90_PULSE,
    CELL90_REVERB,
    CELL90_SLICE,
    CELL90_SLIDE,
    CELL90_STRIDE,
    CELL90_VIBRATO,
    CELL90_VOLUME,
    DEFAULT_VIBRATO90,
    NO_NOTE90,
    RELEASE90,
} from './song';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many characters `formatAudio90Cell` gives a cell's note, instrument and
 * volume, before its effects: `C-4 L v9`.
 */
export const AUDIO90_CELL_TEXT_WIDTH = 8;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The text of one cell of a song's pattern, as a tracker shows it. Parsed by
 * `createAudio90Song`, the text gives the same cell. It starts with three
 * columns, which line up from row to row:
 *
 * - the note, such as `C-4`, `===` for a release, or `...` for none or for
 *   the instrument's own note
 * - the instrument's letter, or a space for none
 * - the volume, such as `v9`, or two spaces for none
 *
 * The cell's effects follow, each after a space, in this order: `a37`, `~`
 * (or `~46`), `>`, `u0C` (or `d0C`), `p8`, `f4`, `P40`, `c47`, `s03`, `r4`,
 * `e2` and `!`. A cell with none ends after its volume's column, at
 * `AUDIO90_CELL_TEXT_WIDTH` characters.
 */
export function formatAudio90Cell(song: Audio90Song, pattern: Audio90SongPattern, row: number, channel: number): string {
    const at = (row * song.channelCount + channel) * CELL90_STRIDE;
    const { cells } = pattern;
    const note = cells[at + CELL90_NOTE];
    const instrument = cells[at + CELL90_INSTRUMENT];
    const volume = cells[at + CELL90_VOLUME];

    let text = note === RELEASE90 ? '===' : note === NO_NOTE90 || cells[at + CELL90_IS_OWN_NOTE] === 1 ? '...' : toNoteName(note);
    text += instrument < 0 ? '  ' : ` ${song.instrumentLetters[instrument]}`;
    text += volume < 0 ? '   ' : ` ${formatHexToken('v', volume, 1)}`;

    if (cells[at + CELL90_ARPEGGIO] >= 0) text += ` ${formatHexToken('a', cells[at + CELL90_ARPEGGIO], 2)}`;
    const vibrato = cells[at + CELL90_VIBRATO];
    if (vibrato >= 0) text += vibrato === DEFAULT_VIBRATO90 ? ' ~' : ` ${formatHexToken('~', vibrato, 2)}`;
    if (cells[at + CELL90_GLIDE] === 1) text += ' >';
    const slide = cells[at + CELL90_SLIDE];
    if (slide !== 0) text += ` ${formatHexToken(slide > 0 ? 'u' : 'd', Math.abs(slide), 2)}`;
    if (cells[at + CELL90_PULSE] >= 0) text += ` ${formatHexToken('p', cells[at + CELL90_PULSE], 1)}`;
    if (cells[at + CELL90_BRIGHTNESS] >= 0) text += ` ${formatHexToken('f', cells[at + CELL90_BRIGHTNESS], 1)}`;
    if (cells[at + CELL90_PAN] >= 0) text += ` ${formatHexToken('P', cells[at + CELL90_PAN], 2)}`;
    if (cells[at + CELL90_CHORD] >= 0) text += ` ${formatHexToken('c', cells[at + CELL90_CHORD], 2)}`;
    if (cells[at + CELL90_SLICE] >= 0) text += ` ${formatHexToken('s', cells[at + CELL90_SLICE], 2)}`;
    if (cells[at + CELL90_REVERB] >= 0) text += ` ${formatHexToken('r', cells[at + CELL90_REVERB], 1)}`;
    if (cells[at + CELL90_ECHO] >= 0) text += ` ${formatHexToken('e', cells[at + CELL90_ECHO], 1)}`;
    if (cells[at + CELL90_ACCENT] === 1) text += ' !';
    return text;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A hex token as a pattern writes it, such as `v9` or `P40`. */
function formatHexToken(prefix: string, value: number, digits: number): string {
    return prefix + value.toString(16).toUpperCase().padStart(digits, '0');
}
