import { createAudio90Sound } from 'audio90';

// Sudoku Digger's sound effects, for the Audio90. All were written for this
// demo. They are soft and short, as the demo plays them often and asks to be
// watched more than heard. The tones that follow a digit are played at that
// digit's note on a pentatonic scale, chosen by the audio view, so the
// search and the grader play little tunes as they go. Each plays where its
// cell is, across the grid.

// ---------------------------------------------------------------------------
// Trying puzzles out of sight
// ---------------------------------------------------------------------------

/** A puzzle tried out of sight that came out at the wrong level: a soft, hollow tock. */
export const TRIED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 1400 },
    envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 20 },
    note: 'G-4',
    glideTo: 'D-4',
    lengthMs: 50,
    priority: 0,
    volume: 1.4,
});

/** The puzzle chosen, as it came out at the level asked for: two bells, up an octave. */
export const CHOSEN = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 500, sustain: 0, releaseMs: 200 } },
        { ratio: 3.5, level: 0.7, envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 100 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    note: 'G-4',
    stepMs: 110,
    steps: `
        +0
        +12
    `,
    lengthMs: 300,
    priority: 2,
    volume: 1.2,
    echo: 0.3,
});

// ---------------------------------------------------------------------------
// Making the grid
// ---------------------------------------------------------------------------

/** A seed dropping into the grid: a soft bell, struck and dying away. */
export const SEED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 500, sustain: 0, releaseMs: 150 } },
        { ratio: 3.5, level: 0.6, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 80 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    note: 'C-5',
    lengthMs: 160,
    priority: 1,
    volume: 1.03,
    echo: 0.15,
});

/** The search trying a digit: a tiny, quiet blip. */
export const TRY = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 2200 },
    envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 15 },
    note: 'C-6',
    lengthMs: 35,
    priority: 0,
    maxVoices: 3,
    volume: 1.6,
});

/** The search backing up at a dead end: a soft, low thump, falling. */
export const DEAD_END = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 0, decayMs: 90, sustain: 0, releaseMs: 30 },
    note: 'A-3',
    glideTo: 'E-3',
    lengthMs: 80,
    priority: 0,
    maxVoices: 2,
    volume: 1.26,
});

/** The search giving up, and the grid wiped: a dark sweep, falling an octave and a half. */
export const GAVE_UP = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 3, detune: 0.2, spread: 0.6 },
    filter: { mode: 'lowpass12', cutoffHz: 1200 },
    envelope: { attackMs: 10, decayMs: 500, sustain: 0, releaseMs: 200 },
    note: 'E-4',
    glideTo: 'A-2',
    lengthMs: 500,
    priority: 2,
    volume: 2.25,
    reverb: 0.2,
});

/** The grid full: bells rising through a major chord. */
export const FILLED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 400, sustain: 0, releaseMs: 150 } },
        { ratio: 3.5, level: 0.7, envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 80 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    note: 'C-5',
    stepMs: 70,
    steps: `
        +0
        +4
        +7
        +12
    `,
    lengthMs: 320,
    priority: 2,
    volume: 1.2,
    echo: 0.25,
});

// ---------------------------------------------------------------------------
// Digging
// ---------------------------------------------------------------------------

/** A cell dug out: a bright, clear chime. */
export const DUG = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 350, sustain: 0, releaseMs: 120 } },
        { ratio: 2, level: 0.5, envelope: { attackMs: 0, decayMs: 150, sustain: 0, releaseMs: 80 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    note: 'C-6',
    lengthMs: 120,
    priority: 1,
    volume: 0.85,
    echo: 0.2,
});

/** A cell that must stay, as another digit gives a second solution: a muted knock, down a fourth. */
export const NEEDED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 60 } },
        { ratio: 1, level: 0.8, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 40 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    note: 'G-3',
    stepMs: 110,
    steps: `
        +0
        -5
    `,
    lengthMs: 220,
    priority: 1,
    volume: 1.6,
});

/** A cell held, as its row or column can spare no more givens: a dry tick. */
export const HELD = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 1800 },
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 10 },
    note: 'E-4',
    lengthMs: 25,
    priority: 1,
    volume: 1.9,
});

// ---------------------------------------------------------------------------
// Shuffling and grading
// ---------------------------------------------------------------------------

/** A shuffle: a breath of noise, brightening and fading. */
export const SHUFFLE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1500 },
    stepMs: 60,
    steps: `
        # brightness  volume
        f4            v6
        f7            vA
        fA            vC
        f8            v8
        f6            v4
        f5            v2
    `,
    envelope: { attackMs: 20, decayMs: 0, sustain: 1, releaseMs: 150 },
    priority: 1,
    volume: 5.4,
    reverb: 0.2,
});

/** The pencil marks filled in: a quick shimmer of bells, up and down. */
export const MARKED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 120 } },
        { ratio: 4, level: 0.4, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    note: 'G-5',
    stepMs: 45,
    steps: `
        +0
        +5
        +9
        +12
        +9
        +5
    `,
    lengthMs: 300,
    priority: 2,
    volume: 1.5,
    echo: 0.3,
});

/** A digit the grader reasons out: a warm, wooden note. */
export const PLACED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 100 } },
        { ratio: 4, level: 0.35, envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 30 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 100 },
    note: 'C-5',
    lengthMs: 100,
    priority: 1,
    volume: 0.96,
});

/** Pencil marks rubbed out by a technique: a soft brush of high noise. */
export const RUBBED_OUT = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'highpass', cutoffHz: 4000 },
    envelope: { attackMs: 5, decayMs: 120, sustain: 0, releaseMs: 40 },
    lengthMs: 110,
    priority: 1,
    volume: 0.85,
});

/** The grader stuck, so the puzzle needs guesswork: two low notes, falling a semitone, with a slow swell. */
export const STUCK = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 3, detune: 0.15, spread: 0.6 },
    filter: { mode: 'lowpass12', cutoffHz: 900 },
    envelope: { attackMs: 60, decayMs: 300, sustain: 0.6, releaseMs: 300 },
    note: 'D-3',
    stepMs: 300,
    steps: `
        +0
        -1
    `,
    lengthMs: 700,
    priority: 2,
    volume: 0.56,
    reverb: 0.3,
});

/** A puzzle finished: bells climbing two octaves through a major ninth chord, ringing in the echo. */
export const FINISHED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 600, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 0.7, envelope: { attackMs: 0, decayMs: 250, sustain: 0, releaseMs: 120 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'C-5',
    stepMs: 80,
    steps: `
        +0
        +4
        +7
        +11
        +14
        +19
        +24
    `,
    lengthMs: 700,
    priority: 2,
    volume: 1.47,
    echo: 0.35,
});
