import { type Audio90Instrument, createAudio90Instrument, createAudio90Sample, createAudio90Song } from '@mvtjs/chiptune';

// Neon Monsoon's instruments, for the Audio90. All were written for this
// game, in the sound of the 1990s' arcade shooters and 16-bit consoles: an
// FM lead and bass, bells for the arpeggios, a wide pad under them, drums,
// and an orchestra hit for the warning. The chip plays them in its
// `console` character.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** The lead: two FM pairs, one a little detuned, its modulators swelling after the note, with a delayed vibrato. */
export const LEAD = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 10, decayMs: 600, sustain: 0.75, releaseMs: 180 } },
        { level: 1.1, envelope: { attackMs: 40, decayMs: 500, sustain: 0.5, releaseMs: 180 } },
        { detuneCents: 8, level: 0.8, envelope: { attackMs: 10, decayMs: 600, sustain: 0.75, releaseMs: 180 } },
        { ratio: 2, level: 0.45, envelope: { attackMs: 30, decayMs: 400, sustain: 0.35, releaseMs: 180 } },
    ],
    feedback: 0.3,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 180 },
    vibrato: { semitones: 0.18, hz: 5.5, delayMs: 220 },
    volume: 0.4,
});

/** The bells, which play the chords as arpeggios: a modulator at three and a half times the note, struck and dying away. */
export const BELLS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 500, sustain: 0.15, releaseMs: 200 } },
        { ratio: 3.5, level: 0.9, envelope: { attackMs: 0, decayMs: 250, sustain: 0, releaseMs: 150 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    stepMs: 50,
    volume: 0.3,
});

/** The pad, which holds each chord under the bells: five saws, swelling in, darkened. */
export const PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.2, spread: 0.8 },
    filter: { cutoffHz: 1400, resonance: 0.1 },
    envelope: { attackMs: 300, decayMs: 600, sustain: 0.8, releaseMs: 600 },
    volume: 0.14,
});

/** Long notes on an electric piano, for the slow tune: a tine over a warm body. */
export const EPIANO = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 2, decayMs: 1800, sustain: 0.25, releaseMs: 400 } },
        { level: 0.3, envelope: { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 } },
        { level: 0.6, detuneCents: 7, envelope: { attackMs: 2, decayMs: 1200, sustain: 0.1, releaseMs: 400 } },
        { ratio: 11, level: 0.12, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 } },
    ],
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 400 },
    vibrato: { semitones: 0.08, hz: 4.5, delayMs: 300 },
    volume: 0.5,
});

/** The bass: an FM pair whose modulator bites and fades on each note, feeding back a little. */
export const BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 400, sustain: 0.5, releaseMs: 60 } },
        { level: 1.4, envelope: { attackMs: 0, decayMs: 160, sustain: 0.2, releaseMs: 60 } },
    ],
    feedback: 0.3,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.5,
});

/** A kick: a sine that falls two octaves as it starts. */
export const KICK = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 260, sustain: 0, releaseMs: 40 },
    note: 'C-2',
    volume: 1,
});

/** A snare: a crack of noise over a short, falling body. */
export const SNARE = createAudio90Instrument({
    oscillator: { wave: 'triangle' },
    noise: 0.9,
    modEnvelope: { to: 'pitch', amount: 7, envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 } },
    filter: { mode: 'highpass', cutoffHz: 400, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 150, sustain: 0, releaseMs: 50 },
    note: 'D-4',
    volume: 0.6,
});

/** A closed hat: a tick of high noise. */
export const HAT = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.8,
    filter: { mode: 'highpass', cutoffHz: 8000, resonance: 0.2 },
    envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 20 },
    volume: 0.35,
});

/** A crash, at the start of each part of a tune. */
export const CRASH = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.9,
    filter: { mode: 'highpass', cutoffHz: 4500, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 1200, sustain: 0, releaseMs: 400 },
    volume: 0.3,
});

// ---------------------------------------------------------------------------
// The orchestra hit
// ---------------------------------------------------------------------------

/** A brass stab for the hit: an FM pair, swelling bright and gone. */
const HIT_BRASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 5, decayMs: 400, sustain: 0.3, releaseMs: 150 } },
        { level: 1.5, envelope: { attackMs: 15, decayMs: 300, sustain: 0.2, releaseMs: 150 } },
    ],
    feedback: 0.25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    volume: 0.45,
});

/** The crack on top of the hit: a burst of bright noise. */
const HIT_CRACK = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'highpass', cutoffHz: 2500, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 40 },
    volume: 0.6,
});

/** The drum under the hit: a deep sine, falling. */
const HIT_DRUM = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 500, sustain: 0, releaseMs: 80 },
    note: 'A-1',
    volume: 1,
});

/**
 * The storm's orchestra hit: a minor brass chord and a crack over a deep
 * drum, bounced as one sound. The game bounces it as it loads, with
 * `prepareAudio90Samples`, and plays it at any pitch.
 */
export const STORM_HIT_SAMPLE = createAudio90Sample({
    rate: 32000,
    rootNote: 'A-3',
    lengthMs: 700,
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { B: HIT_BRASS, n: HIT_CRACK, k: HIT_DRUM },
        patterns: {
            hit: `
                # brass chord                   | crack | drum
                | A-3 B | C-4 B | E-4 B | A-2 B | n     | k
                | ...   | ...   | ...   | ...   | ...   | ...
                | ===   | ===   | ===   | ===   | ...   | ...
            `,
        },
        order: ['hit'],
    }),
});

/** The orchestra hit, played back from its sample. */
export const STORM_HIT: Audio90Instrument = createAudio90Instrument({
    engine: 'sample',
    sample: STORM_HIT_SAMPLE,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    volume: 0.7,
});

/** Every sample the game plays, to bounce as it loads. */
export const SAMPLES = [STORM_HIT_SAMPLE];
