import { describe, expect, it } from 'vitest';
import { createAudio90Sample, createAudio90Song, createAudio90Sound } from '../audio90';
import { AUDIO90_CELL_TEXT_WIDTH, printAudio90Cell } from './print-audio90-cell';

describe('printing a cell', () => {
    it('prints each cell as a tracker shows it, which parses back into the same cell', () => {
        const sample = createAudio90Sample({ bounce: createToneSong('C-4', 4), slices: 4 });
        const instruments = {
            S: STAB,
            K: createAudio90Sound({ engine: 'fm', operators: [{}], note: 'C-2' }),
            D: createAudio90Sound({ engine: 'sample', sample }),
        };
        const song = createAudio90Song({
            bpm: 120,
            instruments,
            patterns: {
                p: `
                    | C#4 S v8 a37 P40 f4 c47 r6 e3 ! | K          | C-4 D s03
                    | ...                             | C-2 K v4   | s01
                    | E-4 ~ > u0C p8                  | ...        | ...
                    | ===                             | K e2       | ===
                    | A-4 ~46 d03 PFF                 | G#3        | D vF s02
                `,
            },
            order: ['p'],
        });
        const pattern = song.patterns[0];
        expect(song.instrumentLetters).toEqual(['S', 'K', 'D']);
        expect(printAudio90Cell(song, pattern, 0, 0)).toBe('C#4 S v8 a37 f4 P40 c47 r6 e3 !');
        expect(printAudio90Cell(song, pattern, 1, 0)).toBe('...     ');
        expect(printAudio90Cell(song, pattern, 0, 1)).toBe('... K   ');
        expect(printAudio90Cell(song, pattern, 1, 1)).toBe('C-2 K v4');
        expect(printAudio90Cell(song, pattern, 2, 0)).toBe('E-4      ~ > u0C p8');
        expect(printAudio90Cell(song, pattern, 4, 0)).toBe('A-4      ~46 d03 PFF');
        expect(printAudio90Cell(song, pattern, 0, 0).indexOf(' a37')).toBe(AUDIO90_CELL_TEXT_WIDTH);

        const rows: string[] = [];
        for (let row = 0; row < pattern.rowCount; row++) {
            const texts: string[] = [];
            for (let channel = 0; channel < song.channelCount; channel++) texts.push(printAudio90Cell(song, pattern, row, channel));
            rows.push(`| ${texts.join(' | ')}`);
        }
        const parsed = createAudio90Song({ bpm: 120, instruments, patterns: { p: rows.join('\n') }, order: ['p'] });
        expect(Array.from(parsed.patterns[0].cells)).toEqual(Array.from(pattern.cells));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** An analog stab, which can play chords and accents. */
const STAB = createAudio90Sound({ oscillator: { wave: 'saw', unison: 3 } });

/** A song of one tone at `note`, held for `rows` rows, to bounce a sample from. */
function createToneSong(note: string, rows: number) {
    const sine = createAudio90Sound({ engine: 'fm', operators: [{}] });
    const pattern = [`| ${note} T`, ...new Array<string>(rows - 1).fill('| ...')].join('\n');
    return createAudio90Song({ bpm: 120, instruments: { T: sine }, patterns: { p: pattern }, order: ['p'] });
}
