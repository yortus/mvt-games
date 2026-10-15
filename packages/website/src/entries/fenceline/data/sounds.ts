import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Fenceline's instruments and sound effects, for the Audio80. They were all
// written for this game. The tunes are played by a country band: a fiddle,
// a banjo, a plucked bass and a little drum kit, with brushes on the snare.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/**
 * A bowed fiddle. It is a saw wave, mellowed by the songs' low-pass filter
 * `a`, that swells in with each stroke of the bow and wavers once held. It
 * leads every tune.
 */
export const FIDDLE = createInstrument({
    wave: 'saw',
    filter: 'a',
    envelope: { attackMs: 22, decayMs: 500, sustain: 0.65, releaseMs: 110 },
    vibrato: { semitones: 0.18, hz: 5.5, delayMs: 170 },
    echo: 0.2,
    volume: 0.6,
});

/**
 * A banjo, picking rolls under the fiddle. It is a thin pulse, plucked,
 * through the songs' filter `b`, which snaps shut on each note for the
 * banjo's twang.
 */
export const BANJO = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.22,
    filter: 'b',
    filterSweep: { fromHz: 4200, toHz: 1000, ms: 120 },
    envelope: { attackMs: 1, decayMs: 280, sustain: 0, releaseMs: 40 },
    echo: 0.1,
    volume: 0.5,
});

/** A round, plucked bass. */
export const THUMP = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 1, decayMs: 260, sustain: 0, releaseMs: 60 },
    volume: 1,
});

/** A soft kick: a click of noise, then a low triangle, falling. */
export const KICK = createInstrument({
    note: 'C-3',
    envelope: { attackMs: 0, decayMs: 140, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        noise      +24
        triangle   +7
        triangle   +0
        triangle   -5
    `,
    volume: 0.75,
});

/** A snare played with brushes: a soft swish of noise, over a little body. */
export const BRUSH = createInstrument({
    note: 'A-5',
    stepMs: 20,
    envelope: { attackMs: 3, decayMs: 150, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch  vol
        noise      +0     vC
        triangle   -24    v7
        noise      +3     vA
    `,
    volume: 0.45,
});

/** A light tock of noise, off the beat. */
export const TOCK = createInstrument({
    wave: 'noise',
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 },
    volume: 0.2,
});

/** The ute's horn: a buzzy pulse, flicking between two notes a minor third apart, the way a car horn's two notes clash. */
export const HORN = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.4,
    arpeggio: [0, 3],
    envelope: { attackMs: 4, decayMs: 0, sustain: 1, releaseMs: 40 },
    volume: 0.5,
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

/**
 * An extra life: a bright banjo-like run up the G chord and on to the
 * octave, ringing out with a flick of arpeggio at the top.
 */
export const EXTRA_LIFE = createSoundEffect({
    note: 'G-5',
    stepMs: 55,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 260 },
    priority: 3,
    volume: 0.6,
    echo: 0.3,
    steps: `
        # wave      pitch  vol  width
        pulse       -12    vC   p4
        pulse       -8     vC
        pulse       -5     vD
        pulse       +0     vE
        pulse       +4     vE   p3
        pulse       +7     vF
        pulse       +12    vF
        pulse       +7     vD
        pulse       +12    vF   p2
        pulse       +16    vD
        pulse       +12    vB
        pulse       +16    v9
        pulse       +12    v7
        pulse       +16    v5
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
