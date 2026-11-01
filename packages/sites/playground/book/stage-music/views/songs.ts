import { createAudio80Song, createAudio80Sound } from 'audio90';

// The game's music: a short fanfare as a stage starts, and the stage's tune,
// which loops. Each is made once, as this module loads.

/** A plucked, thin square for the melody. */
const LEAD = createAudio80Sound({
    pulseWidth: 0.25,
    envelope: { attackMs: 2, decayMs: 250, sustain: 0.5, releaseMs: 120 },
    echo: 0.25,
});

/** A round triangle bass. */
const BASS = createAudio80Sound({
    wave: 'triangle',
    envelope: { attackMs: 2, decayMs: 180, sustain: 0.6, releaseMs: 50 },
});

/** A kick: a click of noise, then a triangle dropping fast. */
const KICK = createAudio80Sound({
    note: 'C-3',
    envelope: { attackMs: 0, decayMs: 170, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        noise      +24
        triangle   +7
        triangle   +0
        triangle   -5
    `,
});

/** A snare: noise over a short, low body. */
const SNARE = createAudio80Sound({
    note: 'D-5',
    stepMs: 20,
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 0 },
    steps: `
        noise      +0      vF
        triangle   -24     vC
        noise      +0      vB
    `,
});

/** A closed hat: a tick of high noise. */
const HAT = createAudio80Sound({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 },
    volume: 0.25,
});

const BAND = {
    bpm: 140,
    instruments: { L: LEAD, B: BASS, k: KICK, s: SNARE, h: HAT },
    echo: { timeMs: 320, feedback: 0.3, level: 0.35 },
};

/** A rising fanfare, one bar long, as a stage starts. */
export const STAGE_FANFARE = createAudio80Song({
    ...BAND,
    patterns: {
        fanfare: `
            # lead      | bass      | drums
            # -------------------------------
            | G-4 L     | C-3 B     | k
            | ...       | ...       | h
            | C-5       | ...       | h
            | ...       | ...       | h
            | E-5       | ...       | s
            | ...       | ...       | h
            | G-5       | ...       | h
            | ...       | ...       | h
            | C-6 ~     | G-2       | k
            | ...       | ...       | h
            | ...       | ...       | h
            | ...       | ...       | h
            | ...       | C-3       | s
            | ...       | ...       | s
            | ===       | ===       | s
            | ...       | ...       | s
        `,
    },
    order: ['fanfare'],
});

/** The stage's tune, two bars that loop, the second time a fourth higher. */
export const STAGE_TUNE = createAudio80Song({
    ...BAND,
    patterns: {
        a: `
            # lead      | bass      | drums
            # -------------------------------
            | C-5 L     | C-3 B     | k
            | ...       | ...       | h
            | D#5       | C-3       | h
            | ...       | ...       | h
            | G-5       | G-2       | s
            | ...       | ...       | h
            | F-5       | G-2       | h
            | D#5       | ...       | h
            | D-5       | A#2       | k
            | ...       | ...       | h
            | D#5       | A#2       | k
            | ...       | ...       | h
            | C-5       | G-2       | s
            | ...       | ...       | h
            | ===       | G-2       | h
            | ...       | ...       | h
        `,
        b: `
            # lead      | bass      | drums
            # -------------------------------
            | G#4       | G#2       | k
            | ...       | ...       | h
            | C-5       | G#2       | h
            | ...       | ...       | h
            | D#5       | D#3       | s
            | ...       | ...       | h
            | D-5       | D#3       | h
            | C-5       | ...       | h
            | D-5       | A#2       | k
            | ...       | ...       | h
            | F-5       | A#2       | k
            | ...       | ...       | h
            | G-5 ~     | G-2       | s
            | ...       | ...       | h
            | ...       | B-2       | h
            | ===       | ...       | h
        `,
    },
    order: ['a', 'b', 'a+5', 'b'],
    loop: 0,
});
