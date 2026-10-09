import { createInstrument, createSong, createSoundEffect } from '@mvtjs/audio';

// The Arcade's own sounds, which play on the page's Audio80 rather than any
// entry's. They were all written for the Arcade. They are small and soft, at
// about half the peak of a game's effects. They cover the wall's blips, the
// way into and out of an entry, pausing, and the pause menu's volume
// previews.

// ---------------------------------------------------------------------------
// Wavetables
// ---------------------------------------------------------------------------

/** A sine wave, for a soft, round tone. */
const SINE_WAVE = '89AC DEEF FFEE DCA9 8653 2110 0011 2356';
/** A glassy tone. It is a sine wave with its third and fifth harmonics. */
const GLASS_WAVE = '8CEF EEDE EEDE EFEC 8310 1121 1121 1013';

// ---------------------------------------------------------------------------
// The pause menu's previews
// ---------------------------------------------------------------------------

/** The instrument for the music slider's twang. A low saw is strummed up a fifth and an octave, and its filter snaps shut. */
const PLUCK = createInstrument({
    wave: 'saw',
    filter: 'a',
    filterSweep: { fromHz: 2600, toHz: 280, ms: 170 },
    envelope: { attackMs: 1, decayMs: 220, sustain: 0, releaseMs: 80 },
    arpeggio: [0, 7, 12],
    stepMs: 22,
});

/**
 * The music slider's preview, one short twang. It is a song rather than a
 * sound effect, so it plays on the music's voices at the music's volume. It
 * is short, so a slider dragged across its steps plays one twang per step
 * rather than a pile of them.
 */
export const MUSIC_PREVIEW = createSong({
    bpm: 150,
    instruments: { P: PLUCK },
    filters: { a: { mode: 'lowpass', cutoffHz: 1500, resonance: 0.45 } },
    patterns: {
        twang: `
            C-3 P
            ===
        `,
    },
    order: ['twang'],
    volume: 1.6,
});

/** The effects slider's preview. It is a blip that steps up a fifth, then to the octave. */
export const EFFECTS_PREVIEW = createSoundEffect({
    note: 'G-5',
    stepMs: 35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    priority: 0,
    volume: 0.5,
    steps: `
        // wave  pitch  width
        pulse    +0     p4
        pulse    +7
        pulse    +12
    `,
});

// ---------------------------------------------------------------------------
// The wall
// ---------------------------------------------------------------------------

/** The instrument for the search's key ticks. Two ticks at different pitches take turns, so fast typing does not drone. */
const TICK = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.25,
    envelope: { attackMs: 0, decayMs: 25, sustain: 0, releaseMs: 0 },
});

/** A key typed in the search. It is the lower of the two ticks, which take turns. */
export const KEY_TICK_LOW = createSoundEffect({ instrument: TICK, note: 'A-5', lengthMs: 25, priority: 0, volume: 0.3 });
/** A key typed in the search. It is the higher of the two ticks. */
export const KEY_TICK_HIGH = createSoundEffect({ instrument: TICK, note: 'C-6', lengthMs: 25, priority: 0, volume: 0.3 });

/** The keyboard's selection moving to another card. It is a soft, round tick. */
export const CARD_TICK = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: SINE_WAVE,
        envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 },
    }),
    note: 'E-5',
    lengthMs: 45,
    priority: 0,
    volume: 0.5,
});

/** The instrument for a tag's pop. */
const POP = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
});

/** A tag chosen. It is a pop that slides up. */
export const TAG_ADD = createSoundEffect({
    instrument: POP,
    note: 'C-5',
    glideTo: 'G-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.35,
});

/** A tag removed. It is the pop, sliding down. */
export const TAG_REMOVE = createSoundEffect({
    instrument: POP,
    note: 'G-5',
    glideTo: 'C-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.35,
});

/** A search that matches nothing. It is a low, soft bonk. */
export const NO_RESULTS = createSoundEffect({
    instrument: createInstrument({
        wave: 'triangle',
        envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    }),
    note: 'C-3',
    glideTo: 'G-2',
    lengthMs: 140,
    priority: 1,
    volume: 0.7,
});

/** An info panel, or the About note, opening. It is two notes, going up. */
export const PANEL_OPEN = createSoundEffect({
    note: 'E-5',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    priority: 1,
    volume: 0.3,
    wave: 'wavetable',
    wavetable: GLASS_WAVE,
    steps: `
        +0
        +5
    `,
});

/** A panel closing. It is the two notes, going down. */
export const PANEL_CLOSE = createSoundEffect({
    note: 'A-5',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    priority: 1,
    volume: 0.3,
    wave: 'wavetable',
    wavetable: GLASS_WAVE,
    steps: `
        +0
        -5
    `,
});

// ---------------------------------------------------------------------------
// Into an entry, and out
// ---------------------------------------------------------------------------

/** A card launched. It is a coin going in, a bright run up the chord. */
export const LAUNCH = createSoundEffect({
    note: 'C-5',
    stepMs: 40,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    echo: 0.3,
    priority: 2,
    volume: 0.4,
    steps: `
        // wave  pitch  width
        pulse    +0     p3
        pulse    +7
        pulse    +12
        pulse    +19
    `,
});

/** The other cards burning away. It is a rush of noise that swells and dies. Its pitch jumps from step to step, which makes it crackle. */
export const BURN = createSoundEffect({
    note: 'C-4',
    stepMs: 45,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    priority: 2,
    volume: 0.5,
    steps: `
        // wave  pitch  vol
        noise    +24    v4
        noise    +12    v7
        noise    +26    v9
        noise    +14    vB
        noise    +28    vC
        noise    +15    vC
        noise    +27    vB
        noise    +14    vA
        noise    +26    v9
        noise    +13    v8
        noise    +25    v7
        noise    +12    v6
        noise    +24    v5
        noise    +11    v4
        noise    +23    v3
        noise    +10    v2
    `,
});

/**
 * The entry's screen powering on, like an old tube. It is a thunk, then
 * static. The static lasts as long as the beam is a line (the transition's
 * `POWER_ON_BEAM_MS`), and stops as the beam opens out to the picture.
 */
export const POWER_ON = createSoundEffect({
    note: 'C-6',
    stepMs: 25,
    lengthMs: 175,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 15 },
    priority: 2,
    volume: 0.45,
    steps: `
        // wave     pitch   vol
        triangle    -36     vF
        noise       +0      vC
        noise       +3      vB
        noise       +0      vC
        noise       +2      vB
        noise       +0      vC
        noise       +3      vB
    `,
});

/**
 * The entry's screen powering off. Static starts when the picture has
 * squashed to a line and lasts until the dot goes out (the transition's
 * `POWER_OFF_BEAM_MS`). It sinks a little, then ends with a pop.
 */
export const POWER_OFF = createSoundEffect({
    note: 'C-6',
    stepMs: 25,
    lengthMs: 227.5,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 15 },
    priority: 2,
    volume: 0.45,
    steps: `
        // wave  pitch  vol
        noise    +0     vC
        noise    +2     vC
        noise    -1     vB
        noise    +1     vB
        noise    -2     vA
        noise    -1     vA
        noise    -3     v9
        noise    -4     v8
        noise    +12    vF
    `,
});

/** The cards developing back, as the way out ends. It is a glassy shimmer, going up. */
export const DEVELOP = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: GLASS_WAVE,
        envelope: { attackMs: 120, decayMs: 500, sustain: 0, releaseMs: 300 },
        arpeggio: [0, 7, 12, 16, 19, 24],
        stepMs: 60,
        echo: 0.5,
    }),
    note: 'C-5',
    lengthMs: 700,
    priority: 1,
    volume: 0.45,
});

/** An entry that could not load. It is a short buzz, twice. */
export const LOAD_FAILED = createSoundEffect({
    note: 'C-3',
    stepMs: 90,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    priority: 2,
    volume: 0.35,
    steps: `
        // wave        vol
        saw+pulse      vF
        saw+pulse      v0
        saw+pulse      vF
    `,
});

// ---------------------------------------------------------------------------
// Pausing
// ---------------------------------------------------------------------------

/** A game paused. A chime steps up a fourth, then to the octave. */
export const PAUSE = createSoundEffect({
    note: 'E-6',
    stepMs: 55,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    volume: 0.35,
    steps: `
        // wave  pitch  width
        pulse    +0     p4
        pulse    +5
        pulse    +12
    `,
});

/** A game resumed. The chime steps down. */
export const RESUME = createSoundEffect({
    note: 'E-7',
    stepMs: 55,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    volume: 0.35,
    steps: `
        pulse    +0     p4
        pulse    -7
        pulse    -12
    `,
});
