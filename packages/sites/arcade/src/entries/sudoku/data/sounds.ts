import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game.
// They are soft and short, like pencil on paper, since a puzzle is played in
// quiet. A digit placed is played at its own note, chosen by the audio
// view, so each digit has a voice of its own.

/** The picker opening on a cell: a light, dry tick, like a pencil tapped on the table. */
export const OPENED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 3000 },
    envelope: { attackMs: 0, decayMs: 25, sustain: 0, releaseMs: 10 },
    note: 'E-6',
    glideTo: 'B-5',
    lengthMs: 25,
    priority: 1,
    volume: 2.2,
});

/** A digit written in: a warm wooden knock, at the digit's note. */
export const PLACED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 220, sustain: 0, releaseMs: 80 } },
        { ratio: 2, level: 0.5, envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 20 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    note: 'C-5',
    lengthMs: 90,
    priority: 1,
    volume: 1.05,
});

/** A digit written in that breaks a rule: two low, muffled knocks. */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 600 },
    envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 30 },
    note: 'A-3',
    stepMs: 90,
    steps: `
        +0
        -2
    `,
    lengthMs: 160,
    priority: 2,
    volume: 1.75,
});

/** An action taken back: a short blip that slides down, as if run backwards. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 15, decayMs: 50, sustain: 0, releaseMs: 20 },
    note: 'G-5',
    glideTo: 'C-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.9,
});

/** The puzzle solved: a run of soft bells up a major pentatonic scale, ringing on in the echo. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 700, sustain: 0, releaseMs: 300 } },
        { ratio: 3, level: 0.6, envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 150 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'G-4',
    stepMs: 95,
    steps: `
        +0
        +2
        +4
        +7
        +9
        +12
        +16
        +19
    `,
    lengthMs: 900,
    priority: 2,
    volume: 1.6,
    echo: 0.35,
});
