import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Galaxy Raiders' instruments and sound effects for the Audio80, all written
// for this game. An effect whose shape matters is written as a step table.
// Each row of the table is one step, which lasts a 60th of a second unless the
// effect sets `stepMs`. An effect whose shape does not matter is an instrument
// and a note.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** The lead. It is a narrow pulse that sweeps wider and back, with a vibrato that starts once a note is held. */
export const LEAD = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.25,
    pulseSweep: { to: 0.6, ms: 900, isPingPong: true },
    envelope: { attackMs: 3, decayMs: 160, sustain: 0.55, releaseMs: 220 },
    vibrato: { semitones: 0.2, hz: 5.5, delayMs: 180 },
    echo: 0.25,
    volume: 0.7,
});

/** The chords, played as fast arpeggios. It is a square wave, quieter than the lead. */
export const CHORD = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.5,
    envelope: { attackMs: 1, decayMs: 300, sustain: 0.35, releaseMs: 120 },
    echo: 0.2,
    volume: 0.4,
});

/** The bass. It is a saw wave through a resonant filter, which closes on each note. */
export const BASS = createInstrument({
    wave: 'saw',
    envelope: { attackMs: 1, decayMs: 220, sustain: 0.45, releaseMs: 60 },
    filter: 'a',
    filterSweep: { fromHz: 2400, toHz: 450, ms: 180 },
    volume: 0.7,
});

/** The kick drum. One step of noise makes its click, then a triangle wave falls an octave and a half. */
export const KICK = createInstrument({
    note: 'C-3',
    envelope: { attackMs: 0, decayMs: 170, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        noise      +24
        triangle   +7
        triangle   +0
        triangle   -5
        triangle   -9
        triangle   -12
    `,
});

/** The snare drum. One step of a triangle wave gives it body, then a burst of bright noise follows. */
export const SNARE = createInstrument({
    note: 'C-5',
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 0 },
    volume: 0.6,
    steps: `
        triangle   -10
        noise      +12
        noise      +10
        noise      +9
        noise      +8
    `,
});

/** A closed hi-hat. It is a very short burst of high noise. */
export const HAT = createInstrument({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 },
    volume: 0.3,
});

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** The ship's shot. A pulse zap falls two and a half octaves in about a tenth of a second, widening to a square. */
export const SHOT = createSoundEffect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    priority: 0,
    maxVoices: 2,
    volume: 0.64,
    steps: `
        # wave    note   vol  width
        pulse     C-7    vF   p4
        pulse     G-6    vE   p5
        pulse     D-6    vD   p6
        pulse     A-5    vB   p7
        pulse     E-5    v9   p8
        pulse     B-4    v6   p8
        pulse     F#4    v3   p8
    `,
});

/** The instrument for a raider's explosion. It thumps, then bursts into noise that falls in pitch. Each kind of raider plays it at its own note. */
const BOOM = createInstrument({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    steps: `
        triangle  +0    vF
        noise     +24   vF
        noise     +21   vE
        noise     +17   vC
        noise     +14   vA
        noise     +10   v8
        noise     +7    v6
        noise     +2    v4
        noise     -2    v2
    `,
});

/** A scout's explosion. The scout is the smallest raider, so its explosion is the highest. */
export const SCOUT_HIT = createSoundEffect({ instrument: BOOM, note: 'C-4', priority: 2, maxVoices: 2, volume: 1 });

/** A striker's explosion. It is pitched between the scout's and the carrier's. */
export const STRIKER_HIT = createSoundEffect({ instrument: BOOM, note: 'A-3', priority: 2, maxVoices: 2, volume: 1 });

/** A carrier's explosion. The carrier is the biggest raider, so its explosion is the deepest. */
export const CARRIER_HIT = createSoundEffect({ instrument: BOOM, note: 'E-3', priority: 2, maxVoices: 2, volume: 1 });

/** A raider's dive. It is a wavering whistle that falls two octaves. */
export const DIVE = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 20, decayMs: 0, sustain: 1, releaseMs: 150 },
        vibrato: { semitones: 0.4, hz: 9 },
    }),
    note: 'C-6',
    glideTo: 'C-4',
    lengthMs: 700,
    priority: 1,
    maxVoices: 2,
    volume: 0.6,
});

/** The ship's loss. It is a long, low roar that falls slowly. */
export const SHIP_HIT = createSoundEffect({
    note: 'C-4',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 500 },
    stepMs: 45,
    priority: 3,
    steps: `
        triangle  -12   vF
        noise     +19   vF
        noise     +17   vF
        noise     +14   vE
        noise     +12   vE
        noise     +10   vD
        noise     +8    vC
        noise     +6    vB
        noise     +4    vA
        noise     +2    v9
        noise     +0    v8
        noise     -2    v7
        noise     -4    v6
        noise     -6    v5
        noise     -8    v4
        noise     -10   v3
    `,
});

/** The ship's return. It plays four rising notes. */
export const RESPAWN = createSoundEffect({
    note: 'C-5',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    stepMs: 70,
    priority: 3,
    volume: 0.64,
    steps: `
        pulse  +0   p8
        pulse  +4
        pulse  +7
        pulse  +12  p4
    `,
});
