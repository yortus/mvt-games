import { describe, expect, it } from 'vitest';
import { toCutoff, HIGHEST_NOTE, LOWEST_NOTE, MAX_ARPEGGIO, toNoteNumber, VOICE_COUNT, toWaveFlags } from '../core';
import { createInstrument } from './instrument';
import { createSoundEffect } from './sound-effect';
import {
    CELL_ARPEGGIO,
    CELL_FILTER,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_STRIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    createSong,
    DEFAULT_VIBRATO,
    NO_NOTE,
    RELEASE,
    type Song,
    computeSongDurationMs,
    type SongOptions,
} from './song';

const LEAD = createInstrument({ wave: 'pulse' });
const KICK = createInstrument({ wave: 'noise', note: 'C-3' });

describe('tracker notation: cells', () => {
    it('reads a note, an instrument and every effect', () => {
        const cell = parseCell('C#4 L v9 a37 ~46 > u0C p8 fA');
        expect(cell[CELL_NOTE]).toBe(toNoteNumber('C#4'));
        expect(cell[CELL_INSTRUMENT]).toBe(0);
        expect(cell[CELL_VOLUME]).toBe(9);
        expect(cell[CELL_ARPEGGIO]).toBe(0x37);
        expect(cell[CELL_VIBRATO]).toBe(0x46);
        expect(cell[CELL_GLIDE]).toBe(1);
        expect(cell[CELL_SLIDE]).toBe(12);
        expect(cell[CELL_PULSE]).toBe(8);
        expect(cell[CELL_FILTER]).toBe(10);
    });

    it('reads a slide down, and a bare vibrato', () => {
        const cell = parseCell('C-4 L d05 ~');
        expect(cell[CELL_SLIDE]).toBe(-5);
        expect(cell[CELL_VIBRATO]).toBe(DEFAULT_VIBRATO);
    });

    it('reads a letter alone as an instrument, and a letter with digits as an effect', () => {
        const instruments = { u: LEAD, d: LEAD, v: LEAD };
        const song = createSong({ bpm: 120, instruments, patterns: { p: 'C-4 u u0C | C-4 d d05 | C-4 v v9' }, order: ['p'] });
        const { cells } = song.patterns[0];
        expect([cells[CELL_INSTRUMENT], cells[CELL_SLIDE]]).toEqual([0, 12]);
        expect([cells[CELL_STRIDE + CELL_INSTRUMENT], cells[CELL_STRIDE + CELL_SLIDE]]).toEqual([1, -5]);
        expect([cells[2 * CELL_STRIDE + CELL_INSTRUMENT], cells[2 * CELL_STRIDE + CELL_VOLUME]]).toEqual([2, 9]);
    });

    it('does not read a slash or a backslash as a slide', () => {
        expect(() => parseCell('C-4 L /0C')).toThrow("row 0, channel 0: '/0C' is not a note, an instrument or an effect");
        expect(() => parseCell('C-4 L \\0C')).toThrow("row 0, channel 0: '\\0C' is not a note, an instrument or an effect");
    });

    it('reads an empty cell, dots, and a release', () => {
        expect(createSongFromPattern('C-4 L |').patterns[0].cells[CELL_STRIDE + CELL_NOTE]).toBe(NO_NOTE);
        expect(parseCell('...')[CELL_NOTE]).toBe(NO_NOTE);
        expect(parseCell('===')[CELL_NOTE]).toBe(RELEASE);
    });

    it('plays an instrument named alone at its own note, untransposed', () => {
        const cell = parseCell('k');
        expect(cell[CELL_NOTE]).toBe(KICK.note);
        expect(cell[CELL_IS_OWN_NOTE]).toBe(1);
    });

    it('says where a mistake is', () => {
        expect(() => createSongFromPattern(`
            C-4 L | ...
            C-4 Q | ...
        `)).toThrow("pattern 'p', row 1, channel 0: unknown instrument 'Q'");
        expect(() => createSongFromPattern('H-4 L')).toThrow("row 0, channel 0: 'H-4' is not a note");
        expect(() => createSongFromPattern(`
            C-4 L | ...
            C-4 L
        `)).toThrow("pattern 'p', row 1: expected 2 cells (one per channel), found 1");
        expect(() => createSongFromPattern('C-4 D-4 L')).toThrow('two notes');
        expect(() => createSongFromPattern('C-4 L k')).toThrow('two instruments');
        expect(() => createSongFromPattern('=== L')).toThrow('row 0, channel 0: a release (===) cannot name an instrument');
        expect(() => createSongFromPattern('v8 >')).toThrow('a glide needs a note');
    });

    it('rejects a second effect of one kind in a cell', () => {
        const cases: readonly (readonly [string, string])[] = [
            ['C-4 L v8 v9', 'two volumes'],
            ['C-4 L a37 a47', 'two arpeggios'],
            ['C-4 L ~ ~46', 'two vibratos'],
            ['C-4 L u0C d05', 'two slides'],
            ['C-4 L u00 u0C', 'two slides'],
            ['C-4 L p4 p8', 'two pulse widths'],
            ['C-4 L f4 f8', 'two cutoffs'],
            ['C-4 L > >', 'two glides'],
        ];
        for (const [cell, error] of cases) expect(() => createSongFromPattern(cell), cell).toThrow(`row 0, channel 0: ${error}`);
    });

    it('rejects a release with a volume', () => {
        expect(() => createSongFromPattern(`
            C-4 L
            === v8
        `)).toThrow('row 1, channel 0: a release (===) cannot take a volume');
    });

    it('rejects a note above the highest', () => {
        expect(parseCell('G-9 L')[CELL_NOTE]).toBe(HIGHEST_NOTE);
        expect(() => createSongFromPattern('B#9 L')).toThrow("row 0, channel 0: 'B#9' is above G-9, the highest note");
    });
});

describe('tracker notation: songs', () => {
    it('reads one row from each line of a pattern, skipping blank lines and comment lines', () => {
        const pattern = `
            // lead   | drums
            C-4 L     | k

              // bar 2, indented differently
            D-4       | ...
        E-4 v9 | k
        `;
        const song = createSongFromPattern(pattern);
        const { rowCount, cells } = song.patterns[0];
        expect(rowCount).toBe(3);
        const notes = [0, 1, 2].map((row) => cells[row * song.channelCount * CELL_STRIDE + CELL_NOTE]);
        expect(notes).toEqual([toNoteNumber('C-4'), toNoteNumber('D-4'), toNoteNumber('E-4')]);
        expect(cells[2 * song.channelCount * CELL_STRIDE + CELL_VOLUME]).toBe(9);
    });

    it('counts rows from 0 over the lines that are rows, in its errors', () => {
        const pattern = `
            // lead   | drums
            C-4 L     | k

            // bar 2
            D-4 Q     | ...
        `;
        expect(() => createSongFromPattern(pattern)).toThrow("pattern 'p', row 1, channel 0: unknown instrument 'Q'");
    });

    it('reads its order, with transpositions, and its loop', () => {
        const song = createSong({
            bpm: 120,
            instruments: { L: LEAD },
            patterns: { 'verse': 'C-4 L', 'part-2': 'D-4 L' },
            order: ['verse', 'verse+5', 'verse-3', 'part-2'],
            loop: 1,
        });
        expect(song.order.map((entry) => [entry.pattern, entry.transpose])).toEqual([[0, 0], [0, 5], [0, -3], [1, 0]]);
        expect(song.loop).toBe(1);
    });

    it('rejects an instrument not named by one letter', () => {
        expect(() => createSong({ ...ONE_NOTE, instruments: { L: LEAD, Lead: LEAD } })).toThrow("song: instrument 'Lead' needs a one-letter name");
    });

    it('rejects a volume of 0 or less', () => {
        expect(() => createSong({ ...ONE_NOTE, volume: 0 })).toThrow('song: volume must be above 0; got 0');
    });

    it('rejects an order naming no pattern, an empty order, and a loop outside it', () => {
        expect(() => createSong({ ...ONE_NOTE, order: ['q'] })).toThrow("song: order names 'q', which is not a pattern");
        expect(() => createSong({ ...ONE_NOTE, order: [] })).toThrow('song: order is empty');
        expect(() => createSong({ ...ONE_NOTE, loop: 1 })).toThrow('song: loop 1 is not an index into its order (0 to 0)');
    });

    it('rejects a bpm, rows per beat or swing out of range', () => {
        for (const bpm of [0, -120, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => createSong({ ...ONE_NOTE, bpm }), `bpm ${bpm}`).toThrow('song: bpm must be above 0');
        }
        for (const rowsPerBeat of [0, -4, 1.5, Number.NaN]) {
            expect(() => createSong({ ...ONE_NOTE, rowsPerBeat }), `rowsPerBeat ${rowsPerBeat}`).toThrow('song: rowsPerBeat must be a whole number, 1 or more');
        }
        for (const swing of [-0.1, 0.6, Number.NaN]) {
            expect(() => createSong({ ...ONE_NOTE, swing }), `swing ${swing}`).toThrow('song: swing must be from 0 to 0.5');
        }
        expect(createSong({ ...ONE_NOTE, swing: 0.5 }).swing).toBe(0.5);
    });

    it('rejects a pattern with no rows, and more channels than the chip has voices', () => {
        expect(() => createSong({ ...ONE_NOTE, patterns: { p: 'C-4 L', q: '' } })).toThrow("song: pattern 'q' has no rows");
        const onlyComments = `
            // lead

        `;
        expect(() => createSong({ ...ONE_NOTE, patterns: { p: 'C-4 L', q: onlyComments } })).toThrow("song: pattern 'q' has no rows");
        const tooWide = ['C-4 L', ...new Array<string>(VOICE_COUNT).fill('...')].join('|');
        expect(() => createSongFromPattern(tooWide)).toThrow(`song: ${VOICE_COUNT + 1} channels is more than the chip's ${VOICE_COUNT} voices`);
    });

    it('rejects a note on a channel with no instrument named before it in the order', () => {
        expect(() => createSongFromPattern('C-4 L | C-4')).toThrow("song: order entry 0 ('p'), pattern 'p', row 0, channel 1: a note with no instrument named on this channel before it");
        const patterns = { named: 'C-4 L', bare: 'D-4' };
        expect(() => createSong({ ...ONE_NOTE, patterns, order: ['named', 'bare'] })).not.toThrow();
        expect(() => createSong({ ...ONE_NOTE, patterns, order: ['bare', 'named'] })).toThrow("order entry 0 ('bare'), pattern 'bare', row 0, channel 0");
    });

    it('rejects a note its transposition takes out of the chip\'s range, but not an instrument\'s own note', () => {
        const patterns = { top: 'G-9 L', bottom: 'C-0 L', drum: 'k' };
        const options = { ...ONE_NOTE, instruments: { L: LEAD, k: KICK }, patterns };
        expect(() => createSong({ ...options, order: ['top+1'] }))
            .toThrow(`song: order entry 0 ('top+1'), pattern 'top', row 0, channel 0: note ${HIGHEST_NOTE} transposed by 1 is ${HIGHEST_NOTE + 1}`);
        const lowest = toNoteNumber('C-0') ?? 0;
        const down = lowest - LOWEST_NOTE + 1;
        expect(() => createSong({ ...options, order: ['top', `bottom-${down}`] }))
            .toThrow(`order entry 1 ('bottom-${down}'), pattern 'bottom', row 0, channel 0: note ${lowest} transposed by -${down} is ${LOWEST_NOTE - 1}`);
        expect(() => createSong({ ...options, order: [`drum+${HIGHEST_NOTE}`] })).not.toThrow();
    });

    it('lasts as long as its rows take at its tempo', () => {
        const bpm = 150;
        const rowsPerBeat = 4;
        const p = `
            C-4 L
            ...
            ...
        `;
        const song = createSong({ bpm, rowsPerBeat, instruments: { L: LEAD }, patterns: { p }, order: ['p', 'p'] });
        expect(computeSongDurationMs(song)).toBeCloseTo(6 * 60000 / (bpm * rowsPerBeat), 9);
    });
});

describe('tracker notation: instruments and effects', () => {
    it('reads a step table, one step from each line, skipping blank lines and comment lines', () => {
        const steps = `
            // wave    pitch  vol  width  cutoff
            noise      +24    vF

            triangle   -12         p4     f8
            C-5
        `;
        const instrument = createInstrument({ steps });
        expect(instrument.data.steps).toHaveLength(3);
        const [first, second, third] = instrument.data.steps;
        expect(first).toMatchObject({ wave: toWaveFlags('noise'), pitchMode: 'relative', pitch: 24, volume: 1 });
        expect(second).toMatchObject({ wave: toWaveFlags('triangle'), pitch: -12, pulseWidth: 4 / 16, cutoffHz: toCutoff(8) });
        expect(third).toMatchObject({ wave: -1, pitchMode: 'absolute', pitch: toNoteNumber('C-5') });
    });

    it('says which step is wrong, counting only the lines that are steps', () => {
        const steps = `
            // wave
            pulse

            pulse sine
        `;
        expect(() => createInstrument({ steps })).toThrow("step 1: 'sine' is not a wave");
        expect(() => createInstrument({ steps: 'pulse saw' })).toThrow('step 0: two waves');
        expect(() => createInstrument({ steps: 'pulse\nB#9' })).toThrow("step 1: 'B#9' is above G-9, the highest note");
    });

    it('rejects an instrument note above the highest', () => {
        expect(() => createInstrument({ note: 'B#9' })).toThrow("instrument note: 'B#9' is above G-9, the highest note");
    });

    it('reads a wavetable, and rejects one of the wrong length', () => {
        const table = '0123 4567 89AB CDEF FEDC BA98 7654 3210';
        expect(createInstrument({ wave: 'wavetable', wavetable: table }).data.wavetable).toHaveLength(32);
        expect(() => createInstrument({ wavetable: '0123' })).toThrow('32 hex digits');
    });

    it('rejects an arpeggio longer than the chip holds', () => {
        const longest = new Array<number>(MAX_ARPEGGIO).fill(0);
        expect(createInstrument({ arpeggio: longest }).data.arpeggio).toHaveLength(MAX_ARPEGGIO);
        expect(() => createInstrument({ arpeggio: [...longest, 0] }))
            .toThrow(`instrument: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${MAX_ARPEGGIO + 1}`);
    });

    it('rejects a filter sweep from or to 0 Hz', () => {
        expect(() => createInstrument({ filterSweep: { fromHz: 0, toHz: 2000, ms: 100 } })).toThrow("instrument: a filter sweep's fromHz and toHz must be above 0");
        expect(() => createInstrument({ filterSweep: { fromHz: 2000, toHz: 0, ms: 100 } })).toThrow("a filter sweep's fromHz and toHz must be above 0");
        expect(createInstrument({ filterSweep: { fromHz: 200, toHz: 2000, ms: 100 } }).data.filterSweepToHz).toBe(2000);
    });

    it("applies an effect's volume to its note, not to the instrument it builds", () => {
        const volume = 0.5;
        const effect = createSoundEffect({ wave: 'pulse', volume });
        expect(effect.data.volume).toBe(volume);
        expect(effect.data.instrument.volume).toBe(createInstrument({}).data.volume);
    });

    it('lasts as long as its step table by default', () => {
        const stepMs = 20;
        const steps = `
            pulse C-6
            pulse C-5
            pulse C-4
        `;
        expect(createSoundEffect({ stepMs, steps }).data.lengthMs).toBe(3 * stepMs);
    });

    it("plays its instrument's note by default", () => {
        expect(createSoundEffect({ wave: 'saw' }).data.note).toBe(createInstrument({}).note);
        expect(createSoundEffect({ instrument: KICK }).data.note).toBe(KICK.note);
    });

    it('reports a bad note as the effect\'s, not its instrument\'s', () => {
        expect(() => createSoundEffect({ note: 'H-4' })).toThrow("effect note: 'H-4' is not a note");
    });

    it('rejects an instrument given with options to make one', () => {
        expect(() => createSoundEffect({ instrument: LEAD, wave: 'saw', steps: 'C-5' }))
            .toThrow('effect: give either an instrument or the options to make one, not both; found wave, steps with the instrument');
        expect(createSoundEffect({ instrument: LEAD, note: 'C-5', lengthMs: 100 }).data.instrument).toBe(LEAD.data);
    });

    it('rejects a length of 0 or less', () => {
        expect(() => createSoundEffect({ lengthMs: 0 })).toThrow('effect: lengthMs must be above 0; got 0');
        expect(() => createSoundEffect({ lengthMs: -10 })).toThrow('effect: lengthMs must be above 0; got -10');
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_NOTE: SongOptions = { bpm: 120, instruments: { L: LEAD }, patterns: { p: 'C-4 L' }, order: ['p'] };

function createSongFromPattern(pattern: string): Song {
    return createSong({ bpm: 120, instruments: { L: LEAD, k: KICK }, patterns: { p: pattern }, order: ['p'] });
}

function parseCell(text: string): Float64Array {
    return createSongFromPattern(text).patterns[0].cells.subarray(0, CELL_STRIDE);
}
