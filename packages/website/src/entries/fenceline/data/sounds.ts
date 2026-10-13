import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Fenceline's instruments and sound effects, for the Audio80. They were all
// written for this game. The tunes have a country fiddle for a lead, a
// plucked bass and a light tock, like a barn dance band.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** A reedy pulse with a slow vibrato, bowed like a fiddle. It leads every tune. */
export const FIDDLE = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.3,
    pulseSweep: { to: 0.42, ms: 400, isPingPong: true },
    envelope: { attackMs: 12, decayMs: 260, sustain: 0.55, releaseMs: 90 },
    vibrato: { semitones: 0.25, hz: 5.5, delayMs: 140 },
    echo: 0.15,
    volume: 0.75,
});

/** A bright, thin pluck, like a banjo. It plays the jingles' runs. */
export const BANJO = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.18,
    envelope: { attackMs: 1, decayMs: 180, sustain: 0, releaseMs: 50 },
    echo: 0.2,
    volume: 0.8,
});

/** A round, plucked bass. */
export const THUMP = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 1, decayMs: 240, sustain: 0, releaseMs: 60 },
    volume: 1,
});

/** A light tock of noise, off the beat. */
export const TOCK = createInstrument({
    wave: 'noise',
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 0 },
    volume: 0.3,
});

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** One step of wire off the reel: a soft, high tick. */
export const STRING_TICK = createSoundEffect({
    note: 'G-6',
    stepMs: 16,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    priority: 0,
    volume: 0.65,
    steps: `
        # wave   pitch  vol  width
        pulse    +0     v9   p2
        pulse    +5     v5
    `,
});

/** A wire tied off as fence: a hammer on a post, then a bright run up the chord. */
export const TIE_OFF = createSoundEffect({
    note: 'G-5',
    stepMs: 40,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    volume: 0.7,
    echo: 0.25,
    steps: `
        # wave      pitch  vol  width
        noise       +17    vF
        pulse       +0     vE   p3
        pulse       +4     vD
        pulse       +7     vC
        pulse       +12    vB
        pulse       +16    v9
        pulse       +19    v7
    `,
});

/** A sheep penned: a bleat, wavering and falling. */
export const BAA = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw+pulse',
        pulseWidth: 0.35,
        envelope: { attackMs: 25, decayMs: 0, sustain: 1, releaseMs: 120 },
        vibrato: { semitones: 0.7, hz: 17 },
    }),
    note: 'E-5',
    glideTo: 'C-5',
    lengthMs: 380,
    priority: 2,
    maxVoices: 2,
    volume: 0.85,
});

/** A dust devil blowing itself out: a rush of wind, falling away. */
export const BLOW_OUT = createSoundEffect({
    instrument: createInstrument({
        wave: 'noise',
        envelope: { attackMs: 40, decayMs: 0, sustain: 1, releaseMs: 380 },
        vibrato: { semitones: 1.5, hz: 6 },
    }),
    note: 'C-7',
    glideTo: 'C-4',
    lengthMs: 760,
    priority: 3,
    volume: 0.75,
});

/** A beetle hatching: a crack of shell, and a chirp. */
export const HATCH = createSoundEffect({
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    priority: 1,
    volume: 0.6,
    steps: `
        # wave    note   vol  width
        noise     C-7    vD
        noise     G-6    v8
        pulse     E-6    vB   p4
        pulse     A-6    v9
        pulse     E-7    v5
    `,
});

/** Slack running along the wire: a low creak, repeated while it runs. */
export const CREAK = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw+pulse',
        pulseWidth: 0.4,
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 50 },
        vibrato: { semitones: 0.8, hz: 15 },
    }),
    note: 'D-3',
    glideTo: 'A-2',
    lengthMs: 120,
    priority: 1,
    volume: 0.7,
});

/** The wire snapping, or a beetle's bite: a twang, dropping. */
export const SNAP = createSoundEffect({
    note: 'C-6',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 140 },
    priority: 3,
    volume: 0.7,
    steps: `
        # wave      pitch  vol  width
        noise       +12    vF
        pulse       +0     vF   p2
        pulse       -2     vE
        pulse       -5     vC   p3
        pulse       -9     vA
        pulse       -14    v8
        pulse       -19    v5
        pulse       -24    v3
    `,
});
