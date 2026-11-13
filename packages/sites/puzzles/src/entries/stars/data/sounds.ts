import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game.
// They are soft and short, since a puzzle is played in quiet: pencil dots, and
// small glassy twinkles for stars. Each dot in a drag is played a step higher
// than the last, chosen by the audio view, so a long drag climbs.

/** A dot: a tiny, soft tap of a pencil point, at the note the audio view chooses. */
export const DOTTED = createAudio90Sound({
    oscillator: { wave: 'sine' },
    filter: { mode: 'lowpass12', cutoffHz: 1800 },
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 15 },
    note: 'G-4',
    lengthMs: 30,
    priority: 1,
    volume: 1.5,
});

/** A star placed: a small glassy twinkle, a bell and the fifth above it. */
export const STARRED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 320, sustain: 0, releaseMs: 120 } },
        { ratio: 3.5, level: 0.35, envelope: { attackMs: 0, decayMs: 90, sustain: 0, releaseMs: 40 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    note: 'E-6',
    stepMs: 55,
    steps: `
        +0
        +7
    `,
    lengthMs: 260,
    priority: 1,
    volume: 0.9,
    echo: 0.2,
});

/** A mark taken off: a short, airy brush, like a thumb over paper. */
export const RUBBED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 3400 },
    envelope: { attackMs: 8, decayMs: 55, sustain: 0, releaseMs: 25 },
    lengthMs: 55,
    priority: 1,
    volume: 2.2,
});

/** A star that breaks a rule: two low, dull thuds, the second lower. */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 480 },
    envelope: { attackMs: 0, decayMs: 80, sustain: 0, releaseMs: 30 },
    note: 'F-3',
    stepMs: 90,
    steps: `
        +0
        -4
    `,
    lengthMs: 160,
    priority: 2,
    volume: 2,
});

/** An action taken back: a soft blip that slides down. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 10, decayMs: 55, sustain: 0, releaseMs: 20 },
    note: 'C-6',
    glideTo: 'F-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.9,
});

/** The puzzle solved: glassy bells running up a pentatonic scale, ringing on in the echo, like stars coming out. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 700, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 0.4, envelope: { attackMs: 0, decayMs: 220, sustain: 0, releaseMs: 120 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'D-5',
    stepMs: 75,
    steps: `
        +0
        +2
        +4
        +7
        +9
        +12
        +14
        +16
        +19
        +24
    `,
    lengthMs: 950,
    priority: 2,
    volume: 1.3,
    echo: 0.4,
});
