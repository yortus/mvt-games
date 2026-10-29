import { createAudio90Sample } from './audio90-sample';
import { createAudio90Song } from './audio90-song';
import { createAudio90Sound } from './audio90-sound';

/** A song for a sample to bounce: one FM note. */
export const FM_NOTE_SONG = createAudio90Song({
    bpm: 120,
    instruments: { t: createAudio90Sound({ engine: 'fm', operators: [{}, { ratio: 2, level: 0.5 }], algorithm: '2>1' }) },
    patterns: { p: '| C-4 t\n| ===' },
    order: ['p'],
});

/** A song with one of nearly everything a song's text holds: every engine, a sample, a step table and the mix. */
export const SONG_WITH_EVERYTHING = createAudio90Song({
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
        h: createAudio90Sound({ engine: 'sample', sample: createAudio90Sample({ bounce: FM_NOTE_SONG, rate: 16000, loop: { fromMs: 50, toMs: 200 } }), reverb: 0.3 }),
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
