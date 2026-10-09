import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Fuel Run's instruments and sound effects, for the Audio80. They are all
// written for this game. They play square waves, triangles and noise, as the
// arcade boards of its day did. The low-fuel alarm, the saucers' warble and
// the base's siren repeat while their cause lasts. The game's audio view times
// the repeats.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** The tunes' lead. It is a square wave, plain and bright. */
export const SQUARE = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.5,
    envelope: { attackMs: 2, decayMs: 150, sustain: 0.5, releaseMs: 80 },
    volume: 0.75,
});

/** The tunes' bass. It is a triangle wave. */
export const TRIANGLE_BASS = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 2, decayMs: 200, sustain: 0.6, releaseMs: 60 },
    volume: 0.95,
});

/** A snare drum. It is a short burst of noise. */
export const SNARE = createInstrument({
    wave: 'noise',
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 90, sustain: 0, releaseMs: 0 },
    volume: 0.5,
});

// ---------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------

/** A shot. It is a square blip that drops an octave in three steps. */
export const SHOT = createSoundEffect({
    note: 'C-6',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    priority: 0,
    maxVoices: 2,
    volume: 1,
    steps: `
        # wave   pitch  vol
        pulse    +0     vF
        pulse    -5     vB
        pulse    -12    v6
    `,
});

/** A bomb dropped. It is a whistle that falls two octaves as the bomb falls. */
export const BOMB_DROP = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 80 },
    }),
    note: 'A-6',
    glideTo: 'A-4',
    lengthMs: 550,
    priority: 0,
    maxVoices: 2,
    volume: 0.75,
});

/** Fuel taken on, as a fuel tank is destroyed. It is four quick notes, rising up the C chord to the octave. */
export const REFUEL = createSoundEffect({
    note: 'C-5',
    stepMs: 45,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    priority: 2,
    volume: 1,
    steps: `
        pulse   +0    p8
        pulse   +4
        pulse   +7
        pulse   +12
    `,
});

/** One beep of the low-fuel alarm. The game's audio view repeats it while fuel is low, and faster as it runs out. */
export const FUEL_ALARM = createSoundEffect({
    wave: 'pulse',
    pulseWidth: 0.25,
    note: 'A-5',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    lengthMs: 90,
    priority: 2,
    volume: 0.49,
});

/** The ship destroyed. It is a low thud, then a crash of noise that falls away. */
export const SHIP_CRASH = createSoundEffect({
    note: 'C-4',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    priority: 3,
    steps: `
        triangle -12   vF
        noise    +14   vF
        noise    +10   vE
        noise    +7    vD
        noise    +4    vB
        noise    +1    v9
        noise    -2    v7
        noise    -5    v5
        noise    -8    v3
    `,
});

// ---------------------------------------------------------------------------
// The enemies
// ---------------------------------------------------------------------------

/** An enemy blown up. It is a short burst of noise, falling. */
export const EXPLOSION = createSoundEffect({
    note: 'C-4',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 100 },
    priority: 1,
    maxVoices: 3,
    steps: `
        noise   +19   vF
        noise   +14   vE
        noise   +10   vC
        noise   +6    vA
        noise   +3    v7
        noise   +0    v4
    `,
});

/** A rocket leaving the ground. It is a rush of noise that rises two octaves. */
export const ROCKET_LAUNCH = createSoundEffect({
    instrument: createInstrument({
        wave: 'noise',
        envelope: { attackMs: 40, decayMs: 0, sustain: 1, releaseMs: 150 },
    }),
    note: 'C-3',
    glideTo: 'C-5',
    lengthMs: 500,
    priority: 1,
    maxVoices: 2,
    volume: 0.65,
});

/** One warble of the saucers. It is a wavering note, which the game's audio view repeats while any saucer flies. */
export const SAUCER = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 60 },
        vibrato: { semitones: 2, hz: 11 },
    }),
    note: 'E-5',
    lengthMs: 180,
    priority: 0,
    volume: 0.75,
});

/** One rise of the base's siren. The game's audio view repeats it while the scroll is held at the base, until the base is destroyed. */
export const BASE_SIREN = createSoundEffect({
    instrument: createInstrument({
        wave: 'pulse',
        pulseWidth: 0.4,
        envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 100 },
    }),
    note: 'C-5',
    glideTo: 'C-6',
    lengthMs: 350,
    priority: 2,
    volume: 0.5,
});

/** The base destroyed. It is a deep thud, then a long blast of noise that falls away. */
export const BASE_DESTROYED = createSoundEffect({
    note: 'C-3',
    stepMs: 70,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 400 },
    priority: 3,
    steps: `
        triangle  +0    vF
        noise     +24   vF
        noise     +19   vF
        noise     +14   vE
        noise     +10   vD
        noise     +7    vC
        noise     +4    vA
        noise     +2    v8
        noise     +0    v6
        noise     -2    v4
        noise     -4    v2
    `,
});
