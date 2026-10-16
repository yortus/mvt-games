import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Crumb Chase's instruments and sound effects, for the Audio80. They are all
// written for this game. They play on wavetables, for the soft, buzzy tone of
// the arcade boards of its day. A wavetable is a wave shape drawn as 32 hex
// digits, each a level from 0 to F.

// ---------------------------------------------------------------------------
// Wavetables
// ---------------------------------------------------------------------------

/** Nearly a sine. It sounds soft and round. */
const ROUND = '8ABCDEFF FFEDCBA8 75432100 00123457';
/** A sine with its second harmonic. It sounds hollow, and a little nasal. */
const HOLLOW = '8BEFFEB8 7ACDDCA7 48ABBA84 26788762';

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** The tunes' lead. It plays the hollow wavetable, held, with a little vibrato. */
export const PIPE = createInstrument({
    wave: 'wavetable',
    wavetable: HOLLOW,
    envelope: { attackMs: 3, decayMs: 250, sustain: 0.6, releaseMs: 120 },
    vibrato: { semitones: 0.15, hz: 6, delayMs: 150 },
    echo: 0.15,
    volume: 0.85,
});

/** A plucked bass on the round wavetable, for tiptoeing. */
export const PIZZ = createInstrument({
    wave: 'wavetable',
    wavetable: ROUND,
    envelope: { attackMs: 1, decayMs: 180, sustain: 0, releaseMs: 50 },
    volume: 0.9,
});

/** A soft, high blip, for the sneaking tune's tiptoes. */
export const TIP = createInstrument({
    wave: 'wavetable',
    wavetable: HOLLOW,
    envelope: { attackMs: 1, decayMs: 90, sustain: 0, releaseMs: 40 },
    echo: 0.3,
    volume: 0.35,
});

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** The nibble as a crumb is eaten. It is quick, and falls a fifth in three steps. */
const NIBBLE = createInstrument({
    wave: 'wavetable',
    wavetable: HOLLOW,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    steps: `
        wavetable  +0
        wavetable  -3
        wavetable  -7
    `,
});

/** The lower of the two nibbles. The crumbs eaten take turns between the two. */
export const NIBBLE_LOW = createSoundEffect({ instrument: NIBBLE, note: 'D-5', priority: 0, volume: 0.8 });

/** The higher of the two nibbles, a fourth above the lower one. */
export const NIBBLE_HIGH = createSoundEffect({ instrument: NIBBLE, note: 'G-5', priority: 0, volume: 0.8 });
