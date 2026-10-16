import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// The fruit machine's instruments and sound effects for the Audio80, all
// written for this machine. They are the bright beeps and jingles of an
// electronic fruit machine of the 1980s, and the clunks of its mechanism.

// ---------------------------------------------------------------------------
// The jingles' instruments
// ---------------------------------------------------------------------------

/** The jingles' lead. It is a bright, narrow pulse that rings in the echo. */
export const CHIME = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.2,
    envelope: { attackMs: 1, decayMs: 220, sustain: 0.35, releaseMs: 150 },
    echo: 0.35,
    volume: 0.75,
});

/** The jingles' chords, played as arpeggios. It is a square wave that dies quickly. */
export const SPARKLE = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.5,
    envelope: { attackMs: 1, decayMs: 160, sustain: 0.2, releaseMs: 80 },
    echo: 0.25,
    volume: 0.4,
});

/** The jingles' bass. It is a triangle wave. */
export const BASS = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 2, decayMs: 200, sustain: 0.5, releaseMs: 80 },
    volume: 0.95,
});

// ---------------------------------------------------------------------------
// The mechanism
// ---------------------------------------------------------------------------

/** The lever's pull, or a press of Spin. A clunk is followed by a chirp that rises an octave. */
export const LEVER = createSoundEffect({
    note: 'C-5',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    priority: 2,
    volume: 0.64,
    steps: `
        # wave     pitch  vol  width
        noise      +24    vF
        triangle   -12    vE
        pulse      +0     vB   p4
        pulse      +4     vB
        pulse      +7     vB
        pulse      +12    v9
    `,
});

/** One click of the reels' mechanism. It repeats fast while the reels turn. */
export const REEL_CLICK = createSoundEffect({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 25, sustain: 0, releaseMs: 0 },
    lengthMs: 25,
    priority: 0,
    volume: 0.45,
});

/** A reel landing. It is a thunk of noise, then a triangle wave that falls in pitch as it fades. */
export const REEL_STOP = createSoundEffect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    priority: 1,
    maxVoices: 2,
    steps: `
        # wave      note   vol
        noise       G-5    vC
        triangle    C-4    vF
        triangle    A-3    vB
        triangle    F-3    v6
        triangle    D-3    v3
    `,
});

// ---------------------------------------------------------------------------
// Winning, and not
// ---------------------------------------------------------------------------

/** A coin. It is a high, bright clink, which repeats while a win is shown off. */
export const COIN = createSoundEffect({
    note: 'E-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    priority: 1,
    maxVoices: 2,
    volume: 0.36,
    steps: `
        pulse   +0    p3
        pulse   +7
        pulse   +12
    `,
});

/** The chime for a winning way. It ripples up a major chord and rings in the echo. */
const WAY = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.25,
    envelope: { attackMs: 1, decayMs: 400, sustain: 0, releaseMs: 100 },
    arpeggio: [0, 4, 7, 12],
    stepMs: 45,
    echo: 0.4,
});

/** A winning way of three. Longer ways ring higher. */
export const WAY_OF_3 = createSoundEffect({ instrument: WAY, note: 'C-5', lengthMs: 400, priority: 2, volume: 0.8 });

/** A winning way of four. */
export const WAY_OF_4 = createSoundEffect({ instrument: WAY, note: 'E-5', lengthMs: 400, priority: 2, volume: 0.8 });

/** A winning way of five. */
export const WAY_OF_5 = createSoundEffect({ instrument: WAY, note: 'G-5', lengthMs: 400, priority: 2, volume: 0.8 });

/** A spin that won nothing. Two notes fall, like a sigh. */
export const NO_WIN = createSoundEffect({
    note: 'G-4',
    stepMs: 140,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 1,
    volume: 0.81,
    steps: `
        pulse   +0    p8
        pulse   -5
    `,
});
