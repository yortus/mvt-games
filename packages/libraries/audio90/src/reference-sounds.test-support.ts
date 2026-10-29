import { createAudio80Song, createAudio80Sound } from './audio80';
import { createAudio90Sample, createAudio90Song, createAudio90Sound } from './audio90';

// The reference set: songs and sounds that between them use every part of
// both chips, each wave, engine, filter, effect and token. Their rendered
// hashes, in `reference-sounds.test.ts`, catch any change to what the chips
// sound like. Render them to listen with
// `npm run render-wav -- src/reference-sounds.test-support.ts`.
//
// They were written to cover the chips, not to be music. A change here
// changes their hashes, so add a sound rather than change one.

// ---------------------------------------------------------------------------
// The Audio80's sounds
// ---------------------------------------------------------------------------

const PLUCK_80 = { attackMs: 2, decayMs: 250, sustain: 0.4, releaseMs: 120 };

export const AUDIO80_TRIANGLE = createAudio80Sound({ wave: 'triangle', note: 'C-4', lengthMs: 300, envelope: PLUCK_80 });
export const AUDIO80_SAW = createAudio80Sound({ wave: 'saw', note: 'C-4', lengthMs: 300, envelope: PLUCK_80 });
export const AUDIO80_PULSE_SWEEP = createAudio80Sound({
    wave: 'pulse',
    pulseWidth: 0.125,
    pulseSweep: { to: 0.875, ms: 400, isPingPong: true },
    note: 'A-3',
    lengthMs: 500,
});
export const AUDIO80_NOISE_THROUGH_A_SWEPT_FILTER = createAudio80Sound({
    wave: 'noise',
    filter: 'a',
    filterSweep: { fromHz: 6000, toHz: 300, ms: 400 },
    note: 'C-6',
    lengthMs: 400,
    envelope: { attackMs: 0, decayMs: 400, sustain: 0, releaseMs: 60 },
});
export const AUDIO80_WAVETABLE = createAudio80Sound({
    wave: 'wavetable',
    wavetable: '89AB CDEF FEDC BA98 7654 3210 0123 4567',
    note: 'E-4',
    lengthMs: 300,
});
export const AUDIO80_ALL_THREE_WAVES = createAudio80Sound({ wave: 'triangle+saw+pulse', note: 'G-3', lengthMs: 300 });
export const AUDIO80_STEP_TABLE = createAudio80Sound({
    note: 'E-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    steps: `
        # wave   pitch  width
        pulse    +0     p3
        pulse    +7
        saw      +12    p8
        noise    +0
    `,
});
export const AUDIO80_ARPEGGIO_AND_VIBRATO = createAudio80Sound({
    wave: 'pulse',
    arpeggio: [0, 4, 7],
    vibrato: { semitones: 0.5, hz: 6, delayMs: 100 },
    note: 'C-5',
    lengthMs: 500,
});
export const AUDIO80_GLIDE_AND_ECHO = createAudio80Sound({
    wave: 'saw',
    note: 'C-4',
    glideTo: 'C-5',
    lengthMs: 300,
    echo: 0.6,
});

// ---------------------------------------------------------------------------
// The Audio80's song
// ---------------------------------------------------------------------------

const LEAD_80 = createAudio80Sound({ wave: 'pulse', filter: 'a', envelope: PLUCK_80 });
const BASS_80 = createAudio80Sound({ wave: 'triangle', filter: 'b', envelope: { attackMs: 2, decayMs: 200, sustain: 0.6, releaseMs: 80 } });
const RING_80 = createAudio80Sound({ wave: 'triangle', ringSource: 1, envelope: PLUCK_80 });
const SYNC_80 = createAudio80Sound({ wave: 'saw', syncSource: 1, envelope: PLUCK_80 });
const KICK_80 = createAudio80Sound({ wave: 'triangle', note: 'C-3', lengthMs: 80, glideTo: 'C-1' });
const HAT_80 = createAudio80Sound({ wave: 'noise', note: 'C-7', lengthMs: 30, envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 10 } });

/** Every token a cell can hold, on both filters and the echo, with swing. */
export const AUDIO80_SONG = createAudio80Song({
    bpm: 140,
    swing: 0.2,
    instruments: { L: LEAD_80, B: BASS_80, R: RING_80, S: SYNC_80, k: KICK_80, h: HAT_80 },
    filters: {
        a: { mode: 'lowpass', cutoffHz: 1500, resonance: 0.7, drive: 0.3 },
        b: { mode: 'bandpass+highpass', cutoffHz: 400, resonance: 0.3 },
    },
    echo: { timeMs: 210, feedback: 0.4, level: 0.4 },
    patterns: {
        a: `
            # lead          | bass    | ring and sync | drums
            | C-5 L v9 p4   | C-3 B   | E-4 R a37     | k
            | ...           | ...     | ...           | h
            | E-5 ~ f8      | G-2     | G-4 S ~46     | h
            | G-5 >         | ...     | ===           | k
            | C-6 u02       | C-3 v6  | C-5 R         | h
            | ... d05       | ...     | ...           | h
            | ===           | ===     | ===           | k
            | B-4 L a00 fF  | G-2 B   | D-5 S         | h
        `,
    },
    order: ['a', 'a+3'],
    loop: 0,
});

// ---------------------------------------------------------------------------
// The Audio90's sounds
// ---------------------------------------------------------------------------

const BODY = { attackMs: 2, decayMs: 1800, sustain: 0.2, releaseMs: 300 };
const TINE = { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 };
const SNAP = { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 40 };

export const AUDIO90_FM_PIANO = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: BODY },
        { level: 0.3, velocity: 0.8, envelope: { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 } },
        { level: 0.6, detuneCents: 7, envelope: BODY },
        { ratio: 11, level: 0.12, velocity: 1, envelope: TINE },
    ],
    rateScaling: 0.4,
    note: 'C-4',
    lengthMs: 600,
    chorus: 0.4,
    reverb: 0.3,
});
export const AUDIO90_FM_WAVES_AND_FEEDBACK = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { wave: 'half-sine' },
        { ratio: 3.5, level: 0.5, wave: 'quarter-sine' },
        { fixedHz: 220, level: 0.3, wave: 'abs-sine' },
    ],
    feedback: 0.4,
    note: 'A-3',
    lengthMs: 400,
});
export const AUDIO90_SUPERSAW = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 7, detune: 0.3, spread: 0.8 },
    filter: { cutoffHz: 6000 },
    note: 'E-4',
    lengthMs: 400,
    pan: -0.5,
});
export const AUDIO90_ACID = createAudio90Sound({
    oscillator: { wave: 'saw' },
    filter: { mode: 'lowpass24', cutoffHz: 280, resonance: 0.88, drive: 0.4, keyTrack: 0.5, accent: 0.6 },
    modEnvelope: { to: 'cutoff', amount: 3.2, envelope: SNAP },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 25 },
    glideMs: 70,
    isLegato: true,
    note: 'C-2',
    glideTo: 'C-3',
    lengthMs: 400,
});
export const AUDIO90_REESE_WITH_SUB_AND_LFO = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 2, detune: 0.12 },
    sub: 0.6,
    filter: { mode: 'lowpass12', cutoffHz: 900 },
    lfo: { shape: 'triangle', rateHz: 3, cutoff: 0.6, pitch: 0.2, delayMs: 50 },
    note: 'E-2',
    lengthMs: 500,
});
export const AUDIO90_SYNCED_PULSE = createAudio90Sound({
    oscillator: { wave: 'pulse', pulseWidth: 0.3 },
    oscillatorB: { interval: 7, level: 0.5, isSynced: true },
    filter: { mode: 'highpass', cutoffHz: 300 },
    vibrato: { semitones: 0.3, hz: 5 },
    note: 'C-4',
    lengthMs: 400,
    echo: 0.5,
});
export const AUDIO90_CHORD_AND_ARPEGGIO = createAudio90Sound({
    oscillator: { wave: 'triangle', chord: [0, 4, 7] },
    filter: { mode: 'bandpass', cutoffHz: 1200, resonance: 0.4 },
    arpeggio: [0, 12],
    note: 'C-4',
    lengthMs: 400,
});
export const AUDIO90_GATED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    lfo: { shape: 'square', rateBeats: 1 / 4, volume: 1, isRetriggered: true },
    note: 'G-4',
    lengthMs: 500,
});
export const AUDIO90_RANDOM_LFO_BRIGHTNESS = createAudio90Sound({
    oscillator: { wave: 'saw' },
    filter: { cutoffHz: 2000 },
    lfo: { shape: 'random', rateHz: 8, cutoff: 0.8 },
    modEnvelope: { to: 'brightness', amount: 1, envelope: SNAP },
    note: 'D-4',
    lengthMs: 400,
});
export const AUDIO90_KICK = createAudio90Sound({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 20 },
    note: 'C-2',
    lengthMs: 300,
});
export const AUDIO90_NOISE_STEPS = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 2400 },
    stepMs: 40,
    steps: `
        # brightness  volume
        fF            vF
        fA            vC
        f7            v8
        f4            v5
        f2            v2
    `,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    reverb: 0.3,
});

// ---------------------------------------------------------------------------
// The Audio90's samples
// ---------------------------------------------------------------------------

const STAB_SOURCE = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 3, detune: 0.2 },
    filter: { cutoffHz: 3000 },
    modEnvelope: { to: 'cutoff', amount: -2, envelope: SNAP },
});

/** A chord bounced at a low rate and depth, looping back and forth while it is held. */
export const AUDIO90_STAB_SAMPLE = createAudio90Sample({
    rate: 22050,
    bits: 8,
    rootNote: 'C-4',
    lengthMs: 400,
    loop: { fromMs: 150, toMs: 350, isPingPong: true },
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { S: STAB_SOURCE },
        patterns: { hit: '| C-4 S | E-4 S | G-4 S' },
        order: ['hit'],
    }),
});

/** A two-beat drum pattern, bounced at 12 bits and cut into 8 slices. */
export const AUDIO90_BREAK_SAMPLE = createAudio90Sample({
    rate: 26000,
    bits: 12,
    slices: 8,
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { k: AUDIO90_KICK, n: AUDIO90_NOISE_STEPS },
        patterns: { beat: '| k\n| ...\n| n\n| ...\n| k\n| k\n| n\n| ...' },
        order: ['beat'],
    }),
});

export const AUDIO90_SAMPLED_STAB = createAudio90Sound({ engine: 'sample', sample: AUDIO90_STAB_SAMPLE, note: 'E-4', lengthMs: 600 });
export const AUDIO90_REVERSED_STAB = createAudio90Sound({
    engine: 'sample',
    sample: AUDIO90_STAB_SAMPLE,
    isReversed: true,
    filter: { cutoffHz: 1500, resonance: 0.3 },
    note: 'C-4',
    lengthMs: 300,
});

// ---------------------------------------------------------------------------
// The Audio90's songs
// ---------------------------------------------------------------------------

const BREAK = createAudio90Sound({ engine: 'sample', sample: AUDIO90_BREAK_SAMPLE, rootNote: 'C-4' });
const RAVE_STAB = createAudio90Sound({ oscillator: { wave: 'saw' }, filter: { cutoffHz: 2500 }, modEnvelope: { to: 'cutoff', amount: -2, envelope: SNAP } });

/** Every setting and token a song for the Audio90 adds, on the `studio` character. */
const SONG_90 = {
    bpm: 128,
    instruments: { P: AUDIO90_FM_PIANO, Q: AUDIO90_ACID, C: RAVE_STAB, b: BREAK, k: AUDIO90_KICK },
    mixer: [{ pan: -0.3, chorus: 0.3 }, {}, { reverb: 0.4, echo: 0.3 }, { pan: 0.2 }],
    pump: { channel: 3, depth: 0.45, releaseMs: 180 },
    reverb: { size: 0.6, decayMs: 1500, damping: 0.4, level: 0.35 },
    echo: { timeBeats: 3 / 4, feedback: 0.4, toneHz: 3000, isPingPong: true, level: 0.3 },
    chorus: { depth: 0.5, rateHz: 0.8, level: 0.5 },
    patterns: {
        a: `
            # piano        | acid        | stabs        | break and kick
            | C-4 P P40    | C-2 Q       | C-4 C c37 r6 | C-4 b s00
            | ...          | C-2 !       | ...          | C-4 b s01
            | E-4 f8       | C-3 >       | ===          | k
            | ...          | C-2 v8      | E-4 C c47 e3 | C-4 b s03
            | G-4 PC0      | D#2 !       | ...          | C-4 b s04
            | ...          | C-2 u0C     | ===          | k
            | ===          | ===         | G-4 C        | C-4 b s06
            | B-3 P fF     | C-2         | ===          | k
        `,
    },
    order: ['a', 'a-2'],
    loop: 0,
} as const;

export const AUDIO90_SONG_STUDIO = createAudio90Song({ ...SONG_90, character: 'studio' });
export const AUDIO90_SONG_CONSOLE = createAudio90Song({ ...SONG_90, character: 'console' });
export const AUDIO90_SONG_SAMPLER = createAudio90Song({ ...SONG_90, character: 'sampler', swing: 0.15, volume: 0.8 });
