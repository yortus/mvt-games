import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Burrow Bust's instruments and sound effects, for the Audio80. They were
// all written for this game. The tunes' leads and basses play on wavetables,
// for a soft, buzzy tone like an early arcade machine's. A wavetable is 32
// steps of 16 levels, drawn here as hex digits. Every note of the walking
// tune dies away by itself, so the tune falls quiet when the digger stops.

// ---------------------------------------------------------------------------
// Wavetables
// ---------------------------------------------------------------------------

/** Nearly a sine wave, soft and round. */
const ROUND = '8ABCDEFF FFEDCBA8 75432100 00123457';
/** A falling ramp with a flat top, bright and buzzy. */
const BUZZY = 'FFFFEEDD CCBBAA99 77665544 33221100';

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** A bright pluck that dies away. It leads the walking tune and the level-clear run. */
export const PLINK = createInstrument({
    wave: 'wavetable',
    wavetable: BUZZY,
    envelope: { attackMs: 1, decayMs: 200, sustain: 0, releaseMs: 60 },
    echo: 0.15,
    volume: 0.8,
});

/** A round pluck that dies away. It plays the bass of every tune. */
export const BOUNCE = createInstrument({
    wave: 'wavetable',
    wavetable: ROUND,
    envelope: { attackMs: 1, decayMs: 220, sustain: 0, releaseMs: 60 },
    volume: 0.95,
});

/** A light tock of noise, on the beat. */
export const TOCK = createInstrument({
    wave: 'noise',
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 0 },
    volume: 0.3,
});

/** The round wavetable, held, with a vibrato. It leads the jingles. */
export const SING = createInstrument({
    wave: 'wavetable',
    wavetable: ROUND,
    envelope: { attackMs: 4, decayMs: 300, sustain: 0.7, releaseMs: 200 },
    vibrato: { semitones: 0.2, hz: 6, delayMs: 120 },
    echo: 0.2,
    volume: 0.9,
});

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** The pump shooting out: a quick rising zip. */
export const HARPOON = createSoundEffect({
    note: 'C-5',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    priority: 1,
    volume: 0.49,
    steps: `
        # wave   pitch  vol  width
        pulse    +0     vF   p3
        pulse    +5     vE
        pulse    +10    vC
        pulse    +14    vA
        pulse    +17    v7
        pulse    +19    v4
    `,
});

/**
 * One pump of a creature: a puff of air, then a bright pulse rising. Each
 * pump plays it a little higher. It is bright on purpose, since a low, soft
 * tone is lost under the harpoon's zip on a laptop's or a phone's speakers.
 */
const PUMP = createInstrument({
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.7,
    steps: `
        # wave   pitch  vol  width
        noise    +19    vB
        pulse    +0     vF   p4
        pulse    +2     vE
        pulse    +4     vD   p6
        pulse    +5     vB
        pulse    +7     v8
    `,
});

/** The first pump of a creature, at C-5. */
export const PUMP_1 = createSoundEffect({ instrument: PUMP, note: 'C-5', priority: 1, maxVoices: 2 });
/** The second pump, a minor third higher, at D#5. */
export const PUMP_2 = createSoundEffect({ instrument: PUMP, note: 'D#5', priority: 1, maxVoices: 2 });
/** The third pump, a minor third higher again, at F#5. */
export const PUMP_3 = createSoundEffect({ instrument: PUMP, note: 'F#5', priority: 1, maxVoices: 2 });
/** The fourth pump, which pops the creature, at A-5. */
export const PUMP_4 = createSoundEffect({ instrument: PUMP, note: 'A-5', priority: 1, maxVoices: 2 });

/** A creature popping: a crack of noise, and a bright blip. */
export const POP = createSoundEffect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    priority: 2,
    maxVoices: 2,
    steps: `
        # wave    note   vol
        noise     C-7    vF
        pulse     C-6    vD
        pulse     G-6    vB
        noise     G-6    v8
        noise     C-6    v4
    `,
});

/** A creature under a rock: a low, flat squash. */
export const SQUASH = createSoundEffect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 100 },
    priority: 2,
    maxVoices: 2,
    steps: `
        # wave      note   vol
        noise       C-4    vF
        triangle    C-3    vD
        triangle    A-2    vA
        triangle    F-2    v6
        triangle    D-2    v3
    `,
});

/** A rock working loose: a low creak, wavering. */
export const ROCK_WOBBLE = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw+pulse',
        pulseWidth: 0.4,
        envelope: { attackMs: 20, decayMs: 0, sustain: 1, releaseMs: 80 },
        vibrato: { semitones: 0.7, hz: 14 },
    }),
    note: 'C-3',
    lengthMs: 450,
    priority: 1,
    volume: 0.6,
});

/** A rock falling: a whistle, dropping two octaves. */
export const ROCK_FALL = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 80 },
    }),
    note: 'C-6',
    glideTo: 'C-4',
    lengthMs: 420,
    priority: 1,
    volume: 0.6,
});

/** A rock landing and breaking: a long crash of noise, falling. */
export const ROCK_CRASH = createSoundEffect({
    note: 'C-4',
    stepMs: 35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 160 },
    priority: 2,
    steps: `
        # wave    pitch vol
        triangle  -12   vF
        noise     +12   vF
        noise     +7    vE
        noise     +3    vC
        noise     +0    vA
        noise     -3    v8
        noise     -5    v6
        noise     -7    v4
        noise     -9    v2
    `,
});

/** A salamander drawing breath: a hiss, growing. */
export const FIRE_WARNING = createSoundEffect({
    note: 'C-7',
    stepMs: 60,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    priority: 1,
    volume: 1,
    steps: `
        # wave  vol
        noise   v6
        noise   v8
        noise   vA
        noise   vC
        noise   vF
    `,
});

/** A salamander's fire: a low roar. */
export const FIRE = createSoundEffect({
    instrument: createInstrument({
        wave: 'noise',
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 200 },
        vibrato: { semitones: 1, hz: 9 },
    }),
    note: 'D-5',
    lengthMs: 550,
    priority: 2,
    volume: 0.8,
});

/** A creature passing through the earth as a ghost: an eerie, wavering slide. */
export const GHOST = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 60, decayMs: 0, sustain: 1, releaseMs: 200 },
        vibrato: { semitones: 0.8, hz: 7 },
        echo: 0.4,
    }),
    note: 'A-5',
    glideTo: 'E-5',
    lengthMs: 500,
    priority: 0,
    volume: 0.45,
});
