import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game.
// They are soft and short, like pencil and chalk on paper, since a puzzle is
// played in quiet. Each passage drawn is played a step higher than the last,
// chosen by the audio view, so a long stroke climbs as the path grows.

/** A passage drawn: a short, soft pencil tick, at the note the audio view chooses. */
export const STEPPED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 2400 },
    envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 20 },
    note: 'C-5',
    lengthMs: 40,
    priority: 1,
    volume: 1.6,
});

/** A wall drawn: a dry, hollow knock, like a block of wood set down. */
export const WALLED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 110, sustain: 0, releaseMs: 40 } },
        { ratio: 1.5, level: 0.7, envelope: { attackMs: 0, decayMs: 20, sustain: 0, releaseMs: 10 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    note: 'G-3',
    lengthMs: 60,
    priority: 1,
    volume: 1.4,
});

/** A mark rubbed out: a brief brush of soft noise, like an eraser on paper. */
export const RUBBED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 2800 },
    envelope: { attackMs: 10, decayMs: 70, sustain: 0, releaseMs: 30 },
    lengthMs: 70,
    priority: 1,
    volume: 2.4,
});

/** A mark that breaks a rule: two low, muffled knocks, the second lower. */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 550 },
    envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 30 },
    note: 'G-3',
    stepMs: 85,
    steps: `
        +0
        -3
    `,
    lengthMs: 150,
    priority: 2,
    volume: 1.75,
});

/** A stroke taken back: a short blip that slides down, as if run backwards. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 15, decayMs: 50, sustain: 0, releaseMs: 20 },
    note: 'A-5',
    glideTo: 'D-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.9,
});

/** The maze built: soft bells climbing a major seventh chord, two octaves up, ringing on in the echo. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 650, sustain: 0, releaseMs: 300 } },
        { ratio: 4, level: 0.45, envelope: { attackMs: 0, decayMs: 250, sustain: 0, releaseMs: 150 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'F-4',
    stepMs: 85,
    steps: `
        +0
        +4
        +7
        +11
        +12
        +16
        +19
        +23
        +24
    `,
    lengthMs: 950,
    priority: 2,
    volume: 1.5,
    echo: 0.35,
});
