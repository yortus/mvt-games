import { describe, expect, it } from 'vitest';
import { createAudio90Sample } from './sample';
import { createAudio90Song } from './song';
import { parseAudio90Song, printAudio90Song } from './song-text';
import { createAudio90Sound } from './sound';

describe('a song\'s text', () => {
    it('parses back into the same song, with every engine, a sample, a step table and the mix', () => {
        const parsed = parseAudio90Song(printAudio90Song(SONG));
        expect(parsed).toEqual(SONG);
        expect(printAudio90Song(parsed)).toBe(printAudio90Song(SONG));
    });

    it('holds the options a song was made from, with each pattern and step table as its rows, comments kept', () => {
        const file = JSON.parse(printAudio90Song(SONG)) as Record<string, unknown>;
        expect(file).toMatchObject({ format: 'audio90 song', version: 1, bpm: 128, swing: 0.1, character: 'console' });
        expect(file.patterns).toEqual({ a: ['# lead | drum', '| C-4 L v9 | k', '| E-4 >    | h'], b: ['| G-4 L ~ | k'] });
        expect(file).toMatchObject({ instruments: { L: { steps: ['vF', '+12 v8'] }, h: { sample: { rate: 16000, bounce: { bpm: 120 } } } } });
        // A default left out of the options stays out of the text
        expect(file).not.toHaveProperty('rowsPerBeat');
    });

    it('may give a pattern as one string, as createAudio90Song takes it', () => {
        const text = JSON.stringify({ format: 'audio90 song', version: 1, bpm: 120, instruments: { L: {} }, patterns: { p: '| C-4 L\n| ===' }, order: ['p'] });
        const song = parseAudio90Song(text);
        expect(song.patterns[0].rowCount).toBe(2);
    });

    it('parses into one sample that two instruments share, so it is bounced and kept once', () => {
        const sample = createAudio90Sample({ bounce: BOUNCED, rate: 16000 });
        const song = createAudio90Song({
            bpm: 120,
            instruments: { a: createAudio90Sound({ engine: 'sample', sample }), b: createAudio90Sound({ engine: 'sample', sample, volume: 0.5 }) },
            patterns: { p: '| C-4 a | C-4 b' },
            order: ['p'],
        });
        const [a, b] = parseAudio90Song(printAudio90Song(song)).instruments;
        expect(a.sample).toBe(b.sample);
    });

    it('is refused if it is not an Audio90 song, or not a version this package reads', () => {
        expect(() => parseAudio90Song('{')).toThrow('song text: not JSON');
        expect(() => parseAudio90Song('{ "bpm": 120 }')).toThrow('song text: not an Audio90 song, whose format is "audio90 song"');
        expect(() => parseAudio90Song('{ "format": "audio90 song", "version": 2 }')).toThrow('song text: version 2 is not one this package reads, which is 1');
        expect(() => parseAudio90Song('{ "format": "audio90 song", "version": 1, "bpm": 120, "patterns": {} }')).toThrow('song text: instruments: must be an object');
    });

    it('cannot be printed for a song this package did not make', () => {
        const options = { bpm: 120, instruments: { L: createAudio90Sound({}) }, patterns: { p: '| C-4 L' }, order: ['p'] };
        const song = createAudio90Song(options);
        const copied = { ...song };
        expect(() => printAudio90Song(copied)).toThrow('song: was not made by createAudio90Song');
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A song for a sample to bounce: one FM note. */
const BOUNCED = createAudio90Song({
    bpm: 120,
    instruments: { t: createAudio90Sound({ engine: 'fm', operators: [{}, { ratio: 2, level: 0.5 }], algorithm: '2>1' }) },
    patterns: { p: '| C-4 t\n| ===' },
    order: ['p'],
});

/** A song with one of nearly everything a song's text holds. */
const SONG = createAudio90Song({
    bpm: 128,
    swing: 0.1,
    instruments: {
        L: createAudio90Sound({
            oscillator: { wave: 'saw', unison: 3, detune: 0.2, spread: 0.5 },
            filter: { cutoffHz: 1200, resonance: 0.4 },
            modEnvelope: { to: 'cutoff', amount: 2, envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 50 } },
            glideMs: 40,
            steps: `
                vF
                +12 v8
            `,
        }),
        k: createAudio90Sound({ engine: 'fm', operators: [{}], note: 'C-2', envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 50 } }),
        h: createAudio90Sound({ engine: 'sample', sample: createAudio90Sample({ bounce: BOUNCED, rate: 16000, loop: { fromMs: 50, toMs: 200 } }), reverb: 0.3 }),
    },
    patterns: {
        a: `
            # lead | drum
            | C-4 L v9 | k
            | E-4 >    | h
        `,
        b: '| G-4 L ~ | k',
    },
    order: ['a', 'b+5'],
    loop: 0,
    mixer: [{ pan: -0.3, chorus: 0.2 }, { reverb: 0.1 }],
    reverb: { size: 0.5 },
    echo: { timeBeats: 3 / 4, isPingPong: true },
    pump: { channel: 1 },
    character: 'console',
});
