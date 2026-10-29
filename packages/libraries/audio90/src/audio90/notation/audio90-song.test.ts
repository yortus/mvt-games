import { describe, expect, it } from 'vitest';
import { CELL_INSTRUMENT, CELL_NOTE, CELL_VOLUME } from '../../shared';
import { AUDIO90_EFFECT_DEFAULTS, ENGINE_SAMPLE } from '../synthesiser';
import { createAudio90Sample } from './audio90-sample';
import {
    type Audio90SongOptions,
    CELL90_ACCENT,
    CELL90_BRIGHTNESS,
    CELL90_CHORD,
    CELL90_ECHO,
    CELL90_PAN,
    CELL90_REVERB,
    CELL90_SLICE,
    CELL90_STRIDE,
    createAudio90Song,
    isAudio90Song,
} from './audio90-song';
import { type Audio90Sound, createAudio90Sound } from './audio90-sound';
import { createToneSong } from './tone-song.test-support';

describe('songs', () => {
    it('read the Audio90\'s tokens into each cell', () => {
        const song = createAudio90Song({
            bpm: 120,
            instruments: { S: STAB },
            patterns: { p: '| A-4 S c47 P40 f4 r6 e3 ! v8' },
            order: ['p'],
        });
        const cells = song.patterns[0].cells;
        expect(cells.length).toBe(CELL90_STRIDE);
        expect([cells[CELL_NOTE], cells[CELL_INSTRUMENT], cells[CELL90_CHORD], cells[CELL90_PAN], cells[CELL90_BRIGHTNESS]]).toEqual([69, 0, 0x47, 0x40, 4]);
        expect([cells[CELL90_REVERB], cells[CELL90_ECHO], cells[CELL90_ACCENT], cells[CELL_VOLUME]]).toEqual([6, 3, 1, 8]);
        expect(isAudio90Song(song)).toBe(true);
        expect(song.chip).toBe('audio90');
    });

    it('name the pattern, row and channel of a chord on an instrument that is not analog', () => {
        const piano = createAudio90Sound({ engine: 'fm', operators: [{}] });
        expect(() => createAudio90Song({ bpm: 120, instruments: { S: piano }, patterns: { drop: '| A-4 S\n| A-4 S\n| A-4 S\n| A-4 S c37' }, order: ['drop'] }))
            .toThrow('song: pattern \'drop\', row 3, channel 0: c37 needs an analog instrument, and \'S\' is fm');
    });

    it('check a token against the instrument a channel named earlier, as the order plays', () => {
        const piano = createAudio90Sound({ engine: 'fm', operators: [{}] });
        expect(() => createAudio90Song({ bpm: 120, instruments: { K: piano }, patterns: { p: '| C-4 K\n| E-4 !' }, order: ['p'] }))
            .toThrow('song: order entry 0 (\'p\'), pattern \'p\', row 1, channel 0: ! needs an analog instrument, and \'K\' is fm');
    });

    it('play a slice only of a sample instrument, and only one its sample has', () => {
        const sample = createAudio90Sample({ bounce: createToneSong('C-4', 4), slices: 4 });
        const drums = createAudio90Sound({ engine: 'sample', sample });
        expect(() => createAudio90Song({ bpm: 120, instruments: { D: drums }, patterns: { p: '| C-4 D s04' }, order: ['p'] }))
            .toThrow('s04 is past the last of the 4 slices of \'D\'\'s sample');
        expect(() => createAudio90Song({ bpm: 120, instruments: { S: STAB }, patterns: { p: '| C-4 S s00' }, order: ['p'] }))
            .toThrow('s00 needs a sample instrument, and \'S\' is analog');
        expect(createAudio90Song({ bpm: 120, instruments: { D: drums }, patterns: { p: '| C-4 D s03' }, order: ['p'] }).patterns[0].cells[CELL90_SLICE]).toBe(3);
        expect(drums.data.engine).toBe(ENGINE_SAMPLE);
    });

    it('fill the mixer for every channel, and the effects\' settings left out from the chip\'s defaults', () => {
        const song = createAudio90Song({
            ...TWO_CHANNELS,
            mixer: [{ pan: -0.4, chorus: 0.3 }],
            reverb: { size: 0.8 },
            echo: { timeBeats: 3 / 4, isPingPong: true },
            pump: { channel: 1 },
        });
        expect(song.mixer).toEqual([{ pan: -0.4, reverb: 0, echo: 0, chorus: 0.3 }, { pan: 0, reverb: 0, echo: 0, chorus: 0 }]);
        expect(song.reverb).toEqual({ ...AUDIO90_EFFECT_DEFAULTS.reverb, size: 0.8 });
        expect(song.echo).toMatchObject({ timeBeats: 0.75, isPingPong: true, feedback: AUDIO90_EFFECT_DEFAULTS.echo.feedback });
        expect(song.pump).toEqual({ channel: 1, depth: AUDIO90_EFFECT_DEFAULTS.pump.depth, releaseMs: AUDIO90_EFFECT_DEFAULTS.pump.releaseMs });
        expect(song.chorus).toBeUndefined();
    });

    it('check the mixer, the pump, the echo and the channel count', () => {
        expect(() => createAudio90Song({ ...TWO_CHANNELS, mixer: [{}, {}, {}] })).toThrow('mixer has 3 entries, more than the song\'s 2 channels');
        expect(() => createAudio90Song({ ...TWO_CHANNELS, pump: { channel: 2 } })).toThrow('pump.channel: 2 is not one of the song\'s channels');
        expect(() => createAudio90Song({ ...TWO_CHANNELS, echo: { timeMs: 300, timeBeats: 1 } })).toThrow('give echo.timeMs or echo.timeBeats, not both');
        const seventeen = '|' + new Array(17).fill(' C-4 S ').join('|');
        expect(() => createAudio90Song({ bpm: 120, instruments: { S: STAB }, patterns: { p: seventeen }, order: ['p'] })).toThrow('17 channels is more than the chip\'s 16 voices');
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAB: Audio90Sound = createAudio90Sound({ oscillator: { wave: 'saw', unison: 3, detune: 0.2 }, filter: { cutoffHz: 3000, accent: 0.5 } });

const TWO_CHANNELS: Audio90SongOptions = { bpm: 120, instruments: { S: STAB }, patterns: { p: '| C-4 S | C-3 S' }, order: ['p'] };
