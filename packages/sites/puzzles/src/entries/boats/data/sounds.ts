import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game,
// and all are sounds of a harbour. They are soft and short, since a puzzle
// is played in quiet. Water laps, hulls knock on wood, a little ship's horn
// toots as a boat is moored whole, and when the harbour is solved, its bell
// rings out and the gulls call.

/** Water marked: a small lap of water, a round drop that rises in pitch, with a little splash of noise. */
export const WATERED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    noise: 0.12,
    filter: { mode: 'lowpass12', cutoffHz: 2600 },
    modEnvelope: { to: 'pitch', amount: 9, envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 100, sustain: 0, releaseMs: 30 },
    note: 'A-5',
    lengthMs: 100,
    priority: 1,
    volume: 1.07,
    reverb: 0.15,
});

/** Part of a boat marked: a hollow knock of wood, as a hull nudges a jetty. FM, with a modulator that dies in a moment, as a struck block does. */
export const MOORED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 110, sustain: 0, releaseMs: 40 } },
        { ratio: 2.5, level: 0.5, envelope: { attackMs: 0, decayMs: 25, sustain: 0, releaseMs: 15 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    note: 'D-5',
    lengthMs: 110,
    priority: 1,
    volume: 0.9,
    reverb: 0.12,
});

/** A boat finished: two short toots of a little ship's horn, two reedy saws and a sub through a soft filter. */
export const TOOTED = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 2, detune: 0.1 },
    sub: 0.5,
    filter: { mode: 'lowpass24', cutoffHz: 950, resonance: 0.15 },
    envelope: { attackMs: 25, decayMs: 0, sustain: 1, releaseMs: 70 },
    vibrato: { semitones: 0.08, hz: 5 },
    note: 'D-4',
    stepMs: 130,
    steps: `
        vF
        v0
        vF
    `,
    lengthMs: 400,
    priority: 1,
    volume: 0.58,
    reverb: 0.25,
});

/** A mark taken off: a wave drawing back over shingle, noise through a filter that falls. */
export const RUBBED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 2400 },
    modEnvelope: { to: 'cutoff', amount: -1.4, envelope: { attackMs: 10, decayMs: 120, sustain: 0, releaseMs: 30 } },
    envelope: { attackMs: 15, decayMs: 120, sustain: 0, releaseMs: 30 },
    lengthMs: 130,
    priority: 1,
    volume: 2.5,
});

/** A boat that breaks a rule: two dull bumps of hulls knocking together, the second lower. */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    noise: 0.15,
    filter: { mode: 'lowpass12', cutoffHz: 520 },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    note: 'C-3',
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
    volume: 0.74,
});

/** A stroke taken back: a drop falling back into the water, a sine that slides down. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 8, decayMs: 70, sustain: 0, releaseMs: 20 },
    note: 'E-6',
    glideTo: 'A-5',
    lengthMs: 70,
    priority: 1,
    volume: 0.85,
    reverb: 0.1,
});

/** The puzzle solved: the harbour's bell, a bright FM bell that rings up a major chord, carrying on in the echo. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 1100, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 0.5, envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 120 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'G-5',
    stepMs: 130,
    steps: `
        +0
        +4
        +7
        +12
        +16
        +19
    `,
    lengthMs: 950,
    priority: 2,
    volume: 1,
    echo: 0.35,
    reverb: 0.3,
});

/** Played with the bell: a gull's call over the water, two cries that fall, roughened by a fast wobble in pitch. */
export const CALLED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'bandpass', cutoffHz: 2200, resonance: 0.3 },
    lfo: { rateHz: 24, pitch: 0.5 },
    envelope: { attackMs: 15, decayMs: 0, sustain: 1, releaseMs: 80 },
    note: 'D-6',
    glideTo: 'A-5',
    stepMs: 110,
    steps: `
        vF
        vE
        v0
        +2 vF
        vE
    `,
    lengthMs: 560,
    priority: 1,
    volume: 0.52,
    pan: 0.4,
    reverb: 0.35,
});
