import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Astrovoid's sound effects, for the Audio80. All of them were written for
// this game. It has no music. Instead, a heartbeat of two thumps plays by
// turns, and it quickens as the wave's rocks are broken. The audio view sets
// its timing. Almost every sound is a pulse wave or noise, short and blunt.

// ---------------------------------------------------------------------------
// The heartbeat
// ---------------------------------------------------------------------------

/** One thump of the heartbeat, a low pulse wave that fades fast. */
const THUMP = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.5,
    envelope: { attackMs: 2, decayMs: 160, sustain: 0, releaseMs: 40 },
    volume: 0.9,
});

/** The heartbeat's lower thump, dropping a tone as it fades. The beats take turns, low then high. */
export const BEAT_LOW = createSoundEffect({ instrument: THUMP, note: 'A-1', glideTo: 'G-1', lengthMs: 140, priority: 1 });

/** The heartbeat's higher thump, a fifth above the lower one. It drops a tone too. */
export const BEAT_HIGH = createSoundEffect({ instrument: THUMP, note: 'E-2', glideTo: 'D-2', lengthMs: 140, priority: 1 });

// ---------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------

/** A shot: a short pulse, dropping fast. */
export const FIRE = createSoundEffect({
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    priority: 0,
    maxVoices: 2,
    volume: 0.49,
    steps: `
        # wave   pitch  vol  width
        pulse    +0     vF   p2
        pulse    -5     vC
        pulse    -9     v9
        pulse    -12    v6
        pulse    -14    v3
    `,
});

/** The engine: a burst of low noise, played again and again while the ship thrusts. */
export const THRUST = createSoundEffect({
    instrument: createInstrument({
        wave: 'noise',
        envelope: { attackMs: 15, decayMs: 0, sustain: 1, releaseMs: 70 },
    }),
    note: 'D-3',
    lengthMs: 90,
    priority: 0,
    maxVoices: 2,
    volume: 0.6,
});

/** The ship destroyed: a long crash of noise, sinking. */
export const SHIP_EXPLODE = createSoundEffect({
    note: 'C-4',
    stepMs: 55,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    priority: 3,
    steps: `
        # wave  pitch vol
        noise   +19   vF
        noise   +14   vF
        noise   +10   vE
        noise   +7    vD
        noise   +4    vC
        noise   +2    vB
        noise   +0    vA
        noise   -2    v8
        noise   -4    v7
        noise   -6    v5
        noise   -8    v3
    `,
});

/** The ship coming back, its pieces drawing together: a rising sweep. */
export const RESPAWN = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 30, decayMs: 0, sustain: 1, releaseMs: 120 },
        vibrato: { semitones: 0.3, hz: 12 },
    }),
    note: 'C-4',
    glideTo: 'C-6',
    lengthMs: 450,
    priority: 3,
    volume: 0.6,
});

// ---------------------------------------------------------------------------
// The rocks
// ---------------------------------------------------------------------------

/** A rock breaking: a burst of noise, falling. */
const CRUNCH = createInstrument({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    stepMs: 30,
    steps: `
        # wave  pitch vol
        noise   +17   vF
        noise   +12   vE
        noise   +8    vC
        noise   +5    vA
        noise   +2    v7
        noise   +0    v4
    `,
});

/** A big rock breaking, slower and deeper. */
const BIG_CRUNCH = createInstrument({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 140 },
    stepMs: 45,
    steps: `
        # wave  pitch vol
        noise   +17   vF
        noise   +12   vF
        noise   +8    vD
        noise   +5    vB
        noise   +2    v8
        noise   +0    v5
        noise   -2    v3
    `,
});

/** A large rock breaking, the deepest crunch. */
export const BREAK_LARGE = createSoundEffect({ instrument: BIG_CRUNCH, note: 'C-3', priority: 2, maxVoices: 2 });

/** A medium rock breaking. */
export const BREAK_MEDIUM = createSoundEffect({ instrument: CRUNCH, note: 'G-3', priority: 2, maxVoices: 2 });

/** A small rock breaking, the highest crunch and a little quieter. */
export const BREAK_SMALL = createSoundEffect({ instrument: CRUNCH, note: 'D-4', priority: 2, maxVoices: 2, volume: 0.85 });

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

/** A wave cleared: three rising chimes. */
export const WAVE_CLEAR = createSoundEffect({
    note: 'C-6',
    stepMs: 90,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    echo: 0.5,
    priority: 3,
    volume: 0.36,
    steps: `
        # wave  pitch width
        pulse   +0    p4
        pulse   +7
        pulse   +12
    `,
});

/** The last ship lost: a low, metallic knell, ringing out. */
export const GAME_OVER = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw+pulse',
        pulseWidth: 0.35,
        envelope: { attackMs: 2, decayMs: 2500, sustain: 0, releaseMs: 300 },
        echo: 0.6,
    }),
    note: 'D-2',
    lengthMs: 2500,
    priority: 3,
});
