import { describe, expect, it } from 'vitest';
import { AUDIO90_CELL_TEXT_WIDTH, createAudio90Instrument, createAudio90Song } from 'audio90';
import { TUNES } from '#tunes';
import { createPatternSheet, INK_BAR_ROW, INK_BEAT_ROW, INK_DOT, INK_EFFECT, INK_NOTE, INK_ROW, ROW_NUMBER_WIDTH } from './pattern-sheet';
import { DOT_GLYPH, GLYPH_WIDTH, RULE_GLYPH } from './pixel-font';
import { SCREEN_WIDTH } from './view-constants';

describe('pattern sheet', () => {
    it('lays out each row as its number, then each channel\'s cell between rules, with a dot for each blank', () => {
        const sheet = createPatternSheet({ song: SONG });
        expect(readLine(sheet, 0, 0)).toBe('00|C-4 L v9 P40 ...|... k .. ...|');
        expect(readLine(sheet, 0, 1)).toBe('01|E-4 . .. ~   >  |=== . .. ...|');
        expect(readLine(sheet, 0, 2)).toBe('02|... . .. ... ...|... . .. ...|');
    });

    it('gives each channel a column for every effect its busiest cell has, and one at least', () => {
        const sheet = createPatternSheet({ song: SONG });
        const effectWidth = 4;
        expect(sheet.channelWidths).toEqual([AUDIO90_CELL_TEXT_WIDTH + 2 * effectWidth, AUDIO90_CELL_TEXT_WIDTH + effectWidth]);
        expect(sheet.channelColumns).toEqual([ROW_NUMBER_WIDTH, ROW_NUMBER_WIDTH + sheet.channelWidths[0] + 1]);
        expect(sheet.width).toBe(sheet.channelColumns[1] + sheet.channelWidths[1] + 1);
    });

    it('inks the notes, the effects and the blanks, and the row numbers by beat and by bar', () => {
        const sheet = createPatternSheet({ song: SONG });
        const at = (row: number, column: number) => sheet.inks[0][row * sheet.width + column];
        expect([at(0, 0), at(1, 0), at(4, 0), at(16, 0)]).toEqual([INK_BAR_ROW, INK_ROW, INK_BEAT_ROW, INK_BAR_ROW]);
        expect([at(0, ROW_NUMBER_WIDTH), at(0, ROW_NUMBER_WIDTH + AUDIO90_CELL_TEXT_WIDTH + 1), at(2, ROW_NUMBER_WIDTH)]).toEqual([INK_NOTE, INK_EFFECT, INK_DOT]);
    });

    it('fits every tune\'s pattern across the screen', () => {
        for (const { song } of TUNES) expect(createPatternSheet({ song }).width * GLYPH_WIDTH).toBeLessThanOrEqual(SCREEN_WIDTH);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SONG = createAudio90Song({
    bpm: 120,
    instruments: { L: createAudio90Instrument({ oscillator: { wave: 'saw' } }), k: createAudio90Instrument({ engine: 'fm', operators: [{}], note: 'C-2' }) },
    patterns: {
        p: ['| C-4 L v9 P40 | k', '| E-4 ~ >     | ===', ...new Array<string>(15).fill('| ... | ...')].join('\n'),
    },
    order: ['p'],
});

/** A line of the sheet as text, with `|` for a rule and `.` for a blank's dot. */
function readLine(sheet: ReturnType<typeof createPatternSheet>, pattern: number, row: number): string {
    let text = '';
    for (let i = 0; i < sheet.width; i++) {
        const code = sheet.glyphs[pattern][row * sheet.width + i];
        text += code === RULE_GLYPH ? '|' : code === DOT_GLYPH ? '.' : String.fromCharCode(code);
    }
    return text;
}
