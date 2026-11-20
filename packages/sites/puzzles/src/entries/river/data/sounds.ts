import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game,
// and all are sounds of a valley in spring. They are soft and short, since a
// puzzle is played in quiet. The river bubbles as it is drawn, a bird chirps
// as a flower is planted, the grass rustles, and when the river reaches the
// sea, the water ripples down to it and the birds sing.

/** River drawn across an edge: a bubble in a stream, a small round drop that rises quickly in pitch. */
export const BUBBLED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 7, envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 20 },
    note: 'D-6',
    lengthMs: 60,
    priority: 1,
    volume: 0.8,
    reverb: 0.12,
});

/** A flower planted: a bird's quick chirp, a high sine that sweeps up again and again, with its volume gated in time. */
export const CHIRPED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    lfo: { shape: 'saw', rateHz: 18, pitch: 3, volume: 0.7 },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 30 },
    note: 'A-6',
    lengthMs: 115,
    priority: 1,
    volume: 0.39,
    reverb: 0.15,
});

/** River or a flower taken off: a rustle of grass, bright noise that flutters. */
export const RUSTLED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 5200 },
    lfo: { shape: 'random', rateHz: 40, volume: 0.6 },
    envelope: { attackMs: 10, decayMs: 90, sustain: 0, releaseMs: 30 },
    lengthMs: 100,
    priority: 1,
    volume: 2.2,
});

/** A mark that breaks a rule: a pebble plunking into deep water, twice, a low sine that drops, with a little splash. */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    noise: 0.08,
    filter: { mode: 'lowpass12', cutoffHz: 900 },
    modEnvelope: { to: 'pitch', amount: -5, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    note: 'G-3',
    stepMs: 22,
    steps: `
        vF
        v8
        v3
        v0
        v0
        v0
        -3 vD
        v7
        v3
        v0
    `,
    lengthMs: 220,
    priority: 2,
    volume: 0.56,
});

/** A stroke taken back: a bubble going back down, a sine that slides down. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 8, decayMs: 60, sustain: 0, releaseMs: 20 },
    note: 'D-6',
    glideTo: 'G-5',
    lengthMs: 65,
    priority: 1,
    volume: 0.85,
    reverb: 0.1,
});

/** The puzzle solved: glassy bells rippling down a pentatonic scale and back up, ringing on in the echo, like a stream running to the sea. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 700, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 0.4, envelope: { attackMs: 0, decayMs: 220, sustain: 0, releaseMs: 120 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'A-5',
    stepMs: 70,
    steps: `
        +0
        -3
        -5
        -7
        -10
        -12
        -7
        -3
        +0
        +4
        +7
        +12
    `,
    lengthMs: 1000,
    priority: 2,
    volume: 1.2,
    echo: 0.4,
    reverb: 0.2,
});

/** Played with the ripple: a bird's song, chirps that sweep up, on a short tune of their own, from off to one side. */
export const SANG = createAudio90Sound({
    oscillator: { wave: 'sine' },
    lfo: { shape: 'saw', rateHz: 16, pitch: 3, volume: 0.7 },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 60 },
    note: 'G-6',
    stepMs: 120,
    steps: `
        +0 vF
        +5
        v0
        +2 vF
        +7
        v0
        +9 vF
    `,
    lengthMs: 820,
    priority: 1,
    volume: 0.26,
    pan: -0.45,
    reverb: 0.3,
});
