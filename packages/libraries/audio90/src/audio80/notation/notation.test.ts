import { describe, expect, it } from 'vitest';
import {
    CELL_ARPEGGIO,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    computeSongDurationMs,
    DEFAULT_VIBRATO,
    HIGHEST_NOTE,
    LOWEST_NOTE,
    MAX_ARPEGGIO,
    NO_NOTE,
    RELEASE,
    toNoteNumber,
} from '../../shared';
import { toCutoff, VOICE_COUNT, toWaveFlags } from '../synthesiser';
import { createAudio80Sound, isAudio80Sound } from './sound';
import { CELL_FILTER, CELL_STRIDE, createAudio80Song, type Audio80Song, type Audio80SongOptions } from './song';

const LEAD = createAudio80Sound({ wave: 'pulse' });
const KICK = createAudio80Sound({ wave: 'noise', note: 'C-3' });

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
        const song = createAudio80Song({ bpm: 120, instruments, patterns: { p: '| C-4 u u0C | C-4 d d05 | C-4 v v9' }, order: ['p'] });
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
        expect(createSongFromPattern('| C-4 L |').patterns[0].cells[CELL_STRIDE + CELL_NOTE]).toBe(NO_NOTE);
        expect(parseCell('...')[CELL_NOTE]).toBe(NO_NOTE);
        expect(parseCell('===')[CELL_NOTE]).toBe(RELEASE);
    });

    it('plays an instrument named alone at its own note, untransposed', () => {
        const cell = parseCell('k');
        expect(cell[CELL_NOTE]).toBe(KICK.data.note);
        expect(cell[CELL_IS_OWN_NOTE]).toBe(1);
    });

    it('says where a mistake is', () => {
        expect(() => createSongFromPattern(`
            | C-4 L | ...
            | C-4 Q | ...
        `)).toThrow("pattern 'p', row 1, channel 0: unknown instrument 'Q'");
        expect(() => createSongFromPattern('| H-4 L')).toThrow("row 0, channel 0: 'H-4' is not a note");
        expect(() => createSongFromPattern(`
            | C-4 L | ...
            | C-4 L
        `)).toThrow("pattern 'p', row 1: expected 2 cells (one per channel), found 1");
        expect(() => createSongFromPattern('| C-4 D-4 L')).toThrow('two notes');
        expect(() => createSongFromPattern('| C-4 L k')).toThrow('two instruments');
        expect(() => createSongFromPattern('| === L')).toThrow('row 0, channel 0: a release (===) cannot name an instrument');
        expect(() => createSongFromPattern('| v8 >')).toThrow('a glide needs a note');
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
        for (const [cell, error] of cases) expect(() => createSongFromPattern(`| ${cell}`), cell).toThrow(`row 0, channel 0: ${error}`);
    });

    it('rejects a release with a volume', () => {
        expect(() => createSongFromPattern(`
            | C-4 L
            | === v8
        `)).toThrow('row 1, channel 0: a release (===) cannot take a volume');
    });

    it('rejects a note above the highest', () => {
        expect(parseCell('G-9 L')[CELL_NOTE]).toBe(HIGHEST_NOTE);
        expect(() => createSongFromPattern('| B#9 L')).toThrow("row 0, channel 0: 'B#9' is above G-9, the highest note");
    });
});

describe('tracker notation: songs', () => {
    it('reads one row from each line of a pattern, skipping blank lines and comment lines', () => {
        const pattern = `
            # lead      | drums
            # -----------------
            | C-4 L     | k

                # bar 2, indented differently
            | D-4       | ...
        | E-4 v9    | k
        `;
        const song = createSongFromPattern(pattern);
        const { rowCount, cells } = song.patterns[0];
        expect(rowCount).toBe(3);
        const notes = [0, 1, 2].map((row) => cells[row * song.channelCount * CELL_STRIDE + CELL_NOTE]);
        expect(notes).toEqual([toNoteNumber('C-4'), toNoteNumber('D-4'), toNoteNumber('E-4')]);
        expect(cells[2 * song.channelCount * CELL_STRIDE + CELL_VOLUME]).toBe(9);
    });

    it('rejects a row that does not start with |', () => {
        expect(() => createSongFromPattern('C-4 L | k')).toThrow("song: pattern 'p', row 0: a row starts with |");
        const pattern = ['# lead | drums', '| C-4 L | k', '', 'D-4 | ...'].join('\n');
        expect(() => createSongFromPattern(pattern)).toThrow("song: pattern 'p', row 1: a row starts with |");
    });

    it('ignores a comment at the end of a row, but reads a # inside a token as part of it', () => {
        const pattern = `
            | F#5 L | k     # bar 1
            | G#5   | ...   #a comment with no space after its #
        `;
        const song = createSongFromPattern(pattern);
        const { rowCount, cells } = song.patterns[0];
        expect(rowCount).toBe(2);
        const notes = [0, 1].map((row) => cells[row * song.channelCount * CELL_STRIDE + CELL_NOTE]);
        expect(notes).toEqual([toNoteNumber('F#5'), toNoteNumber('G#5')]);
    });

    it('reads a # with no space before it as part of its token, not as a comment', () => {
        expect(() => createSongFromPattern('| E-5#x L')).toThrow("row 0, channel 0: 'E-5#x' is not a note, an instrument or an effect");
        expect(() => createSongFromPattern('| E-5 L#x')).toThrow("row 0, channel 0: 'L#x' is not a note, an instrument or an effect");
    });

    it('rejects a line that starts with //, which is not a comment', () => {
        const pattern = ['// lead | drums', '| C-4 L | k'].join('\n');
        expect(() => createSongFromPattern(pattern)).toThrow("song: pattern 'p', row 0: a row starts with |");
    });

    it('counts rows from 0 over the lines that are rows, in its errors', () => {
        const pattern = `
            # lead  | drums
            # -------------
            | C-4 L | k

            # bar 2
            | D-4 Q | ...
        `;
        expect(() => createSongFromPattern(pattern)).toThrow("pattern 'p', row 1, channel 0: unknown instrument 'Q'");
    });

    it('reads its order, with transpositions, and its loop', () => {
        const song = createAudio80Song({
            bpm: 120,
            instruments: { L: LEAD },
            patterns: { 'verse': '| C-4 L', 'part-2': '| D-4 L' },
            order: ['verse', 'verse+5', 'verse-3', 'part-2'],
            loop: 1,
        });
        expect(song.order.map((entry) => [entry.pattern, entry.transpose])).toEqual([[0, 0], [0, 5], [0, -3], [1, 0]]);
        expect(song.loop).toBe(1);
    });

    it('rejects an instrument not named by one letter', () => {
        expect(() => createAudio80Song({ ...ONE_NOTE, instruments: { L: LEAD, Lead: LEAD } })).toThrow("song: instrument 'Lead' needs a one-letter name");
    });

    it('rejects a volume of 0 or less', () => {
        expect(() => createAudio80Song({ ...ONE_NOTE, volume: 0 })).toThrow('song: volume must be above 0; got 0');
    });

    it('rejects an order naming no pattern, an empty order, and a loop outside it', () => {
        expect(() => createAudio80Song({ ...ONE_NOTE, order: ['q'] })).toThrow("song: order names 'q', which is not a pattern");
        expect(() => createAudio80Song({ ...ONE_NOTE, order: [] })).toThrow('song: order is empty');
        expect(() => createAudio80Song({ ...ONE_NOTE, loop: 1 })).toThrow('song: loop 1 is not an index into its order (0 to 0)');
    });

    it('rejects a bpm, rows per beat or swing out of range', () => {
        for (const bpm of [0, -120, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => createAudio80Song({ ...ONE_NOTE, bpm }), `bpm ${bpm}`).toThrow('song: bpm must be above 0');
        }
        for (const rowsPerBeat of [0, -4, 1.5, Number.NaN]) {
            expect(() => createAudio80Song({ ...ONE_NOTE, rowsPerBeat }), `rowsPerBeat ${rowsPerBeat}`).toThrow('song: rowsPerBeat must be a whole number, 1 or more');
        }
        for (const swing of [-0.1, 0.6, Number.NaN]) {
            expect(() => createAudio80Song({ ...ONE_NOTE, swing }), `swing ${swing}`).toThrow('song: swing must be from 0 to 0.5');
        }
        expect(createAudio80Song({ ...ONE_NOTE, swing: 0.5 }).swing).toBe(0.5);
    });

    it('rejects a pattern with no rows, and more channels than the chip has voices', () => {
        expect(() => createAudio80Song({ ...ONE_NOTE, patterns: { p: '| C-4 L', q: '' } })).toThrow("song: pattern 'q' has no rows");
        const onlyComments = `
            # lead

        `;
        expect(() => createAudio80Song({ ...ONE_NOTE, patterns: { p: '| C-4 L', q: onlyComments } })).toThrow("song: pattern 'q' has no rows");
        const tooWide = ['', 'C-4 L', ...new Array<string>(VOICE_COUNT).fill('...')].join('|');
        expect(() => createSongFromPattern(tooWide)).toThrow(`song: ${VOICE_COUNT + 1} channels is more than the chip's ${VOICE_COUNT} voices`);
    });

    it('rejects a note on a channel with no instrument named before it in the order', () => {
        expect(() => createSongFromPattern('| C-4 L | C-4')).toThrow("song: order entry 0 ('p'), pattern 'p', row 0, channel 1: a note with no instrument named on this channel before it");
        const patterns = { named: '| C-4 L', bare: '| D-4' };
        expect(() => createAudio80Song({ ...ONE_NOTE, patterns, order: ['named', 'bare'] })).not.toThrow();
        expect(() => createAudio80Song({ ...ONE_NOTE, patterns, order: ['bare', 'named'] })).toThrow("order entry 0 ('bare'), pattern 'bare', row 0, channel 0");
    });

    it('rejects a note its transposition takes out of the chip\'s range, but not an instrument\'s own note', () => {
        const patterns = { top: '| G-9 L', bottom: '| C-0 L', drum: '| k' };
        const options = { ...ONE_NOTE, instruments: { L: LEAD, k: KICK }, patterns };
        expect(() => createAudio80Song({ ...options, order: ['top+1'] }))
            .toThrow(`song: order entry 0 ('top+1'), pattern 'top', row 0, channel 0: note ${HIGHEST_NOTE} transposed by 1 is ${HIGHEST_NOTE + 1}`);
        const lowest = toNoteNumber('C-0') ?? 0;
        const down = lowest - LOWEST_NOTE + 1;
        expect(() => createAudio80Song({ ...options, order: ['top', `bottom-${down}`] }))
            .toThrow(`order entry 1 ('bottom-${down}'), pattern 'bottom', row 0, channel 0: note ${lowest} transposed by -${down} is ${LOWEST_NOTE - 1}`);
        expect(() => createAudio80Song({ ...options, order: [`drum+${HIGHEST_NOTE}`] })).not.toThrow();
    });

    it('lasts as long as its rows take at its tempo', () => {
        const bpm = 150;
        const rowsPerBeat = 4;
        const p = `
            | C-4 L
            | ...
            | ...
        `;
        const song = createAudio80Song({ bpm, rowsPerBeat, instruments: { L: LEAD }, patterns: { p }, order: ['p', 'p'] });
        expect(computeSongDurationMs(song)).toBeCloseTo(6 * 60000 / (bpm * rowsPerBeat), 9);
    });
});

describe('tracker notation: sounds', () => {
    it('reads a step table, one step from each line, skipping blank lines and comment lines', () => {
        const steps = `
            # wave     pitch  vol  width  cutoff
            noise      +24    vF

            triangle   -12         p4     f8
            C-5
        `;
        const sound = createAudio80Sound({ steps });
        expect(sound.data.steps).toHaveLength(3);
        const [first, second, third] = sound.data.steps;
        expect(first).toMatchObject({ wave: toWaveFlags('noise'), pitchMode: 'relative', pitch: 24, volume: 1 });
        expect(second).toMatchObject({ wave: toWaveFlags('triangle'), pitch: -12, pulseWidth: 4 / 16, cutoffHz: toCutoff(8) });
        expect(third).toMatchObject({ wave: -1, pitchMode: 'absolute', pitch: toNoteNumber('C-5') });
    });

    it('ignores a comment at the end of a step, but reads a # inside a token as part of it', () => {
        const steps = `
            noise      +24    # the click
            C#5               # an exact note
        `;
        const [first, second] = createAudio80Sound({ steps }).data.steps;
        expect(first).toMatchObject({ wave: toWaveFlags('noise'), pitch: 24 });
        expect(second).toMatchObject({ pitchMode: 'absolute', pitch: toNoteNumber('C#5') });
        expect(() => createAudio80Sound({ steps: 'noise#x' })).toThrow("step 0: 'noise#x' is not a wave");
    });

    it('rejects a line that starts with //, which is not a comment', () => {
        expect(() => createAudio80Sound({ steps: '// wave\npulse' })).toThrow("step 0: '//' is not a wave");
    });

    it('says which step is wrong, counting only the lines that are steps', () => {
        const steps = `
            # wave
            pulse

            pulse sine
        `;
        expect(() => createAudio80Sound({ steps })).toThrow("step 1: 'sine' is not a wave");
        expect(() => createAudio80Sound({ steps: 'pulse saw' })).toThrow('step 0: two waves');
        expect(() => createAudio80Sound({ steps: 'pulse\nB#9' })).toThrow("step 1: 'B#9' is above G-9, the highest note");
    });

    it('rejects a note above the highest', () => {
        expect(() => createAudio80Sound({ note: 'B#9' })).toThrow("sound: note: 'B#9' is above G-9, the highest note");
        expect(() => createAudio80Sound({ glideTo: 'H-4' })).toThrow("sound: glideTo: 'H-4' is not a note");
    });

    it('reads a wavetable, and rejects one of the wrong length', () => {
        const table = '0123 4567 89AB CDEF FEDC BA98 7654 3210';
        expect(createAudio80Sound({ wave: 'wavetable', wavetable: table }).data.wavetable).toHaveLength(32);
        expect(() => createAudio80Sound({ wavetable: '0123' })).toThrow('32 hex digits');
    });

    it('rejects an arpeggio longer than the chip holds', () => {
        const longest = new Array<number>(MAX_ARPEGGIO).fill(0);
        expect(createAudio80Sound({ arpeggio: longest }).data.arpeggio).toHaveLength(MAX_ARPEGGIO);
        expect(() => createAudio80Sound({ arpeggio: [...longest, 0] }))
            .toThrow(`sound: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${MAX_ARPEGGIO + 1}`);
    });

    it('rejects a filter sweep from or to 0 Hz', () => {
        expect(() => createAudio80Sound({ filterSweep: { fromHz: 0, toHz: 2000, ms: 100 } })).toThrow("sound: a filter sweep's fromHz and toHz must be above 0");
        expect(() => createAudio80Sound({ filterSweep: { fromHz: 2000, toHz: 0, ms: 100 } })).toThrow("a filter sweep's fromHz and toHz must be above 0");
        expect(createAudio80Sound({ filterSweep: { fromHz: 200, toHz: 2000, ms: 100 } }).data.filterSweepToHz).toBe(2000);
    });

    it('lasts as long as its step table by default, or 250 ms with none', () => {
        const stepMs = 20;
        const steps = `
            pulse C-6
            pulse C-5
            pulse C-4
        `;
        expect(createAudio80Sound({ stepMs, steps }).data.lengthMs).toBe(3 * stepMs);
        expect(createAudio80Sound({}).data.lengthMs).toBe(250);
    });

    it('plays C-4 when played with no note, unless it names its own', () => {
        expect(createAudio80Sound({}).data.note).toBe(toNoteNumber('C-4'));
        expect(createAudio80Sound({ note: 'C-2' }).data.note).toBe(toNoteNumber('C-2'));
    });

    it('takes a priority and a number of voices to play on, at least 1', () => {
        expect(createAudio80Sound({}).data).toMatchObject({ priority: 0, maxVoices: 1, glideTo: Number.NaN });
        expect(createAudio80Sound({ priority: 2, maxVoices: 0 }).data).toMatchObject({ priority: 2, maxVoices: 1 });
    });

    it('rejects a length of 0 or less', () => {
        expect(() => createAudio80Sound({ lengthMs: 0 })).toThrow('sound: lengthMs must be above 0; got 0');
        expect(() => createAudio80Sound({ lengthMs: -10 })).toThrow('sound: lengthMs must be above 0; got -10');
    });

    it('knows a sound it made', () => {
        expect(isAudio80Sound(LEAD)).toBe(true);
        expect(isAudio80Sound({ ...LEAD })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_NOTE: Audio80SongOptions = { bpm: 120, instruments: { L: LEAD }, patterns: { p: '| C-4 L' }, order: ['p'] };

function createSongFromPattern(pattern: string): Audio80Song {
    return createAudio80Song({ bpm: 120, instruments: { L: LEAD, k: KICK }, patterns: { p: pattern }, order: ['p'] });
}

function parseCell(text: string): Float64Array {
    return createSongFromPattern(`| ${text}`).patterns[0].cells.subarray(0, CELL_STRIDE);
}
