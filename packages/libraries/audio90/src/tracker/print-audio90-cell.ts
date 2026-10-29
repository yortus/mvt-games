import { AUDIO90_CELL_GRAMMAR, type Audio90Song, type Audio90SongPattern } from '../audio90';
import {
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_SLIDE,
    CELL_VOLUME,
    NO_NOTE,
    printHexToken,
    RELEASE,
    toNoteName,
} from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many characters `printAudio90Cell` gives a cell's note, instrument and
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
export function printAudio90Cell(song: Audio90Song, pattern: Audio90SongPattern, row: number, channel: number): string {
    const at = (row * song.channelCount + channel) * AUDIO90_CELL_GRAMMAR.stride;
    const { cells } = pattern;
    const note = cells[at + CELL_NOTE];
    const instrument = cells[at + CELL_INSTRUMENT];
    const volume = cells[at + CELL_VOLUME];

    let text = note === RELEASE ? '===' : note === NO_NOTE || cells[at + CELL_IS_OWN_NOTE] === 1 ? '...' : toNoteName(note);
    text += instrument < 0 ? '  ' : ` ${song.instrumentLetters[instrument]}`;
    text += volume < 0 ? '   ' : ` ${printHexToken('v', volume, 1)}`;

    for (const token of AUDIO90_CELL_GRAMMAR.tokens) {
        if (token.kind === 'slide') {
            const slide = cells[at + CELL_SLIDE];
            if (slide !== 0) text += ` ${printHexToken(slide > 0 ? 'u' : 'd', Math.abs(slide), 2)}`;
            continue;
        }
        if (token.field === CELL_VOLUME) continue;
        const value = cells[at + token.field];
        if (token.kind === 'flag') {
            if (value === 1) text += ` ${token.token}`;
        }
        else if (value >= 0) {
            text += value === token.bare ? ` ${token.prefix}` : ` ${printHexToken(token.prefix, value, token.digits)}`;
        }
    }
    return text;
}
