import { createAudio90Instrument } from 'audio90';

// The instruments, which the tunes share. Every patch is written for this
// site, from the techniques of the 1990s' synthesisers and
// consoles, not copied from any machine's presets.

// ---------------------------------------------------------------------------
// FM
// ---------------------------------------------------------------------------

/** A bright piano for house: a hammer's click over two bodies, struck hard. */
export const HOUSE_PIANO = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 1, decayMs: 900, sustain: 0.15, releaseMs: 220 } },
        { level: 0.9, velocity: 0.7, envelope: { attackMs: 0, decayMs: 400, sustain: 0.1, releaseMs: 150 } },
        { ratio: 2, level: 0.5, envelope: { attackMs: 1, decayMs: 700, sustain: 0.1, releaseMs: 200 } },
        { ratio: 7, level: 0.25, velocity: 1, envelope: { attackMs: 0, decayMs: 80, sustain: 0, releaseMs: 40 } },
    ],
    rateScaling: 0.3,
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 200 },
    volume: 0.45,
    reverb: 0.2,
});

/** A soft electric piano: a bell-like tine over a warm body, brighter the harder it is struck. */
export const ELECTRIC_PIANO = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 2, decayMs: 1800, sustain: 0.2, releaseMs: 300 } },
        { level: 0.3, velocity: 0.8, envelope: { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 } },
        { level: 0.6, detuneCents: 7, envelope: { attackMs: 2, decayMs: 1200, sustain: 0.1, releaseMs: 300 } },
        { ratio: 11, level: 0.12, velocity: 1, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 } },
    ],
    rateScaling: 0.4,
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 300 },
    volume: 0.5,
    chorus: 0.4,
    reverb: 0.3,
});

/** An organ: four operators side by side, as drawbars at the octaves and the twelfth, with a quick click. */
export const ORGAN = createAudio90Instrument({
    engine: 'fm',
    operators: [
        { ratio: 1 },
        { ratio: 2, level: 0.6 },
        { ratio: 3, level: 0.3 },
        { ratio: 4, level: 0.35, envelope: { attackMs: 0, decayMs: 60, sustain: 0.5, releaseMs: 40 } },
    ],
    envelope: { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.3,
});

/** A hard, metallic bass: one modulator that bites and fades, feeding back on itself a little. */
export const FM_BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 500, sustain: 0.5, releaseMs: 60 } },
        { level: 1.6, velocity: 0.6, envelope: { attackMs: 0, decayMs: 180, sustain: 0.2, releaseMs: 60 } },
    ],
    feedback: 0.35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.55,
});

/** A slapped bass for a fighting game's stage: a pluck that snaps, then a round body. */
export const SLAP_BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 400, sustain: 0.3, releaseMs: 60 } },
        { level: 2, velocity: 0.8, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 30 } },
    ],
    feedback: 0.2,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    volume: 0.55,
});

/** Brass, whose modulators swell a little after its carriers, so each note brightens as it speaks. */
export const BRASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 25, decayMs: 400, sustain: 0.8, releaseMs: 150 } },
        { level: 1.3, envelope: { attackMs: 60, decayMs: 300, sustain: 0.6, releaseMs: 150 } },
        { detuneCents: 9, envelope: { attackMs: 25, decayMs: 400, sustain: 0.8, releaseMs: 150 } },
        { ratio: 2, level: 0.5, envelope: { attackMs: 50, decayMs: 300, sustain: 0.4, releaseMs: 150 } },
    ],
    feedback: 0.2,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    vibrato: { semitones: 0.1, hz: 5.5, delayMs: 300 },
    volume: 0.4,
    reverb: 0.2,
});

/** A console's FM lead guitar: one operator feeding back hard, through a driven filter, singing once it is held. */
export const FM_GUITAR = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 2000, sustain: 0.7, releaseMs: 120 } },
        { level: 1.4, envelope: { attackMs: 0, decayMs: 600, sustain: 0.6, releaseMs: 120 } },
    ],
    feedback: 0.85,
    filter: { cutoffHz: 3800, resonance: 0.2, drive: 0.7 },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    vibrato: { semitones: 0.25, hz: 6, delayMs: 250 },
    volume: 0.35,
    echo: 0.25,
});

/** A bell for the ballad: a modulator at three and a half times the note, so its overtones do not fit the note's. */
export const BELL = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 2500, sustain: 0, releaseMs: 800 } },
        { ratio: 3.5, level: 1.2, envelope: { attackMs: 0, decayMs: 1500, sustain: 0, releaseMs: 800 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 800 },
    volume: 0.35,
    reverb: 0.5,
    echo: 0.2,
});

/** A PC sound card's lead: two operators, the modulator a doubled half sine, a little vibrato. */
export const CARD_LEAD = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { wave: 'half-sine', envelope: { attackMs: 2, decayMs: 600, sustain: 0.7, releaseMs: 90 } },
        { ratio: 2, level: 0.7, wave: 'abs-sine', envelope: { attackMs: 0, decayMs: 300, sustain: 0.5, releaseMs: 90 } },
    ],
    feedback: 0.3,
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 90 },
    vibrato: { semitones: 0.15, hz: 5, delayMs: 200 },
    volume: 0.4,
});

/** The sound card's bass: two operators, the modulator at the note, dying back to a hollow tone. */
export const CARD_BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 400, sustain: 0.6, releaseMs: 60 } },
        { level: 1.1, wave: 'half-sine', envelope: { attackMs: 0, decayMs: 200, sustain: 0.3, releaseMs: 60 } },
    ],
    feedback: 0.4,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    volume: 0.5,
});

/** The sound card's chords: two operators, soft, a quarter-sine modulator for a reedy tone. */
export const CARD_CHORD = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 10, decayMs: 800, sustain: 0.6, releaseMs: 150 } },
        { ratio: 1, level: 0.5, wave: 'quarter-sine', envelope: { attackMs: 0, decayMs: 500, sustain: 0.4, releaseMs: 150 } },
    ],
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 150 },
    volume: 0.25,
});

// ---------------------------------------------------------------------------
// Analog
// ---------------------------------------------------------------------------

/** A trance lead: seven saws, spread wide and detuned, through a filter left open. */
export const SUPERSAW = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 7, detune: 0.3, spread: 0.8 },
    filter: { cutoffHz: 5000, resonance: 0.1, envelope: { octaves: 0.6, decayMs: 250, releaseMs: 100 } },
    envelope: { attackMs: 5, decayMs: 300, sustain: 0.8, releaseMs: 450 },
    lfo: { rateHz: 5.2, pitch: 0.08 },
    volume: 0.3,
    echo: 0.3,
    reverb: 0.35,
});

/** A wide pad: five slow saws, swelling in, with the chorus around them. */
export const PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.25, spread: 0.9 },
    filter: { cutoffHz: 1800, resonance: 0.15 },
    envelope: { attackMs: 500, decayMs: 600, sustain: 0.85, releaseMs: 1200 },
    volume: 0.25,
    chorus: 0.3,
    reverb: 0.5,
});

/** A gated pad for the trance build: the pad's saws, cut into sixteenths by a square LFO on the beat. */
export const GATED_PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.25, spread: 0.9 },
    filter: { cutoffHz: 2400, resonance: 0.15 },
    envelope: { attackMs: 20, decayMs: 0, sustain: 1, releaseMs: 300 },
    lfo: { shape: 'square', rateBeats: 1 / 4, volume: 1 },
    volume: 0.25,
    reverb: 0.3,
});

/** A squelching bass: one saw into a resonant filter that snaps shut, with accents and slides. */
export const ACID = createAudio90Instrument({
    oscillator: { wave: 'saw' },
    filter: { cutoffHz: 280, resonance: 0.88, drive: 0.4, keyTrack: 0.5, accent: 0.6, envelope: { octaves: 3.2, decayMs: 200, releaseMs: 40 } },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 25 },
    legato: { glideMs: 70 },
    volume: 0.45,
    echo: 0.15,
});

/** A bass of two saws drifting against each other, under a filter that wanders, with a sub an octave down. */
export const REESE = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 2, detune: 0.12, spread: 0.3 },
    sub: 0.6,
    filter: { cutoffHz: 500, resonance: 0.2 },
    lfo: { rateHz: 0.3, cutoff: 0.6 },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 120 },
    volume: 0.4,
});

/** A sine sub bass, for jungle and trip-hop. */
export const SUB_BASS = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 3, decayMs: 0, sustain: 1, releaseMs: 80 },
    volume: 0.7,
});

/** A rave stab: three saws through a filter that snaps shut, played as chords with `c`. */
export const STAB = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 3, detune: 0.2, spread: 0.5 },
    filter: { cutoffHz: 1200, resonance: 0.3, envelope: { octaves: 2.2, decayMs: 160, releaseMs: 60 } },
    envelope: { attackMs: 1, decayMs: 260, sustain: 0.25, releaseMs: 120 },
    volume: 0.3,
    reverb: 0.3,
    echo: 0.2,
});

/** A plucked arpeggio for the trance breakdown: a pulse whose filter closes fast. */
export const PLUCK = createAudio90Instrument({
    oscillator: { wave: 'pulse', pulseWidth: 0.3, unison: 2, detune: 0.1, spread: 0.6 },
    filter: { cutoffHz: 600, resonance: 0.4, envelope: { octaves: 3, decayMs: 120, releaseMs: 60 } },
    envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 80 },
    volume: 0.3,
    echo: 0.4,
    reverb: 0.3,
});

/** Strings, played live: five saws, slow to swell, through a gentle filter. Bounced, they are the role-playing tune's sample. */
export const STRINGS = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.2, spread: 0.7 },
    filter: { mode: 'lowpass12', cutoffHz: 2200, resonance: 0.1 },
    envelope: { attackMs: 300, decayMs: 0, sustain: 1, releaseMs: 600 },
    vibrato: { semitones: 0.08, hz: 5, delayMs: 400 },
    volume: 0.3,
    chorus: 0.3,
    reverb: 0.4,
});

// ---------------------------------------------------------------------------
// Drums, from the analog engine
// ---------------------------------------------------------------------------

/** A bass drum: a sine that falls two octaves as it starts. */
export const KICK = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 380, sustain: 0, releaseMs: 60 },
    note: 'C-2',
    volume: 1.2,
});

/** A long, deep bass drum, for jungle and hip hop. */
export const BOOM = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 900, sustain: 0, releaseMs: 200 },
    note: 'A#1',
    volume: 1.2,
});

export const SNARE = createAudio90Instrument({
    oscillator: { wave: 'triangle' },
    noise: 0.9,
    modEnvelope: { to: 'pitch', amount: 7, envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 } },
    filter: { mode: 'highpass', cutoffHz: 350, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 60 },
    note: 'D-4',
    volume: 0.7,
    reverb: 0.25,
});

export const CLAP = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1300, resonance: 0.5 },
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 80 },
    volume: 0.8,
    reverb: 0.3,
});

export const HAT = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.8,
    filter: { mode: 'highpass', cutoffHz: 7500, resonance: 0.2 },
    envelope: { attackMs: 0, decayMs: 50, sustain: 0, releaseMs: 30 },
    volume: 0.45,
    pan: 0.3,
});

export const OPEN_HAT = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.8,
    filter: { mode: 'highpass', cutoffHz: 7000, resonance: 0.2 },
    envelope: { attackMs: 0, decayMs: 240, sustain: 0, releaseMs: 60 },
    volume: 0.35,
    pan: 0.3,
});

export const SHAKER = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.6,
    filter: { mode: 'highpass', cutoffHz: 9000 },
    envelope: { attackMs: 4, decayMs: 35, sustain: 0, releaseMs: 20 },
    volume: 0.35,
    pan: -0.4,
});

export const CRASH = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.9,
    filter: { mode: 'highpass', cutoffHz: 4500, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 1400, sustain: 0, releaseMs: 400 },
    volume: 0.35,
    reverb: 0.3,
});

export const TOM = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 9, envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 80 },
    note: 'G-2',
    volume: 0.9,
    reverb: 0.2,
});

/** A timpani, for the role-playing tune: a low tom that rings and is struck with a little noise. */
export const TIMPANI = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    noise: 0.15,
    modEnvelope: { to: 'pitch', amount: 3, envelope: { attackMs: 0, decayMs: 50, sustain: 0, releaseMs: 0 } },
    filter: { cutoffHz: 900 },
    envelope: { attackMs: 0, decayMs: 1300, sustain: 0, releaseMs: 300 },
    volume: 0.9,
    reverb: 0.4,
});

/** A flute, for the role-playing tune: a near-pure tone that breathes in, with a light modulator and a slow vibrato. */
export const FLUTE = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 40, decayMs: 0, sustain: 1, releaseMs: 150 } },
        { ratio: 2, level: 0.18, envelope: { attackMs: 70, decayMs: 300, sustain: 0.6, releaseMs: 150 } },
    ],
    envelope: { attackMs: 30, decayMs: 0, sustain: 1, releaseMs: 160 },
    vibrato: { semitones: 0.12, hz: 5, delayMs: 250 },
    volume: 0.4,
    echo: 0.3,
    reverb: 0.3,
});

// ---------------------------------------------------------------------------
// The 16-bit platformer
// ---------------------------------------------------------------------------

/** A marimba: a modulator four times the note, struck and gone, for the broken chords. */
export const MARIMBA = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 450, sustain: 0, releaseMs: 120 } },
        { ratio: 4, level: 0.7, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 40 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    volume: 0.45,
    reverb: 0.2,
});

/** A whistling lead: two operators, the modulator feeding back a little, a quick vibrato once held. */
export const WHISTLE = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 8, decayMs: 600, sustain: 0.7, releaseMs: 90 } },
        { ratio: 2, level: 0.35, envelope: { attackMs: 0, decayMs: 200, sustain: 0.3, releaseMs: 90 } },
    ],
    feedback: 0.2,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    vibrato: { semitones: 0.2, hz: 6.5, delayMs: 180 },
    volume: 0.4,
    echo: 0.15,
});

/** A bouncing bass: an FM pluck, round and short. */
export const BOUNCE_BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 260, sustain: 0, releaseMs: 50 } },
        { level: 0.8, envelope: { attackMs: 0, decayMs: 90, sustain: 0, releaseMs: 40 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.6,
});

// ---------------------------------------------------------------------------
// Eurobeat
// ---------------------------------------------------------------------------

/** Eurobeat's lead: three bright saws, their filter flaring on each note, with a quick vibrato. */
export const EURO_LEAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 3, detune: 0.15, spread: 0.5 },
    filter: { cutoffHz: 3500, resonance: 0.2, envelope: { octaves: 1.2, decayMs: 200, releaseMs: 120 } },
    envelope: { attackMs: 2, decayMs: 300, sustain: 0.75, releaseMs: 120 },
    vibrato: { semitones: 0.15, hz: 6, delayMs: 200 },
    volume: 0.3,
    echo: 0.25,
    reverb: 0.2,
});

/** Eurobeat's octave bass: a saw whose filter snaps shut on every note. */
export const EURO_BASS = createAudio90Instrument({
    oscillator: { wave: 'saw' },
    sub: 0.4,
    filter: { cutoffHz: 350, resonance: 0.35, envelope: { octaves: 2.5, decayMs: 110, releaseMs: 60 } },
    envelope: { attackMs: 0, decayMs: 200, sustain: 0.5, releaseMs: 60 },
    volume: 0.55,
});

// ---------------------------------------------------------------------------
// Big beat
// ---------------------------------------------------------------------------

/** A dirty bass riff: two saws driven hard into a resonant filter. */
export const DIRTY_BASS = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 2, detune: 0.12 },
    filter: { cutoffHz: 700, resonance: 0.5, drive: 0.9, envelope: { octaves: 2, decayMs: 160, releaseMs: 80 } },
    envelope: { attackMs: 0, decayMs: 300, sustain: 0.6, releaseMs: 80 },
    volume: 0.4,
});

/** A siren: a pulse whose pitch rises and falls slowly, for the breakdown. */
export const SIREN = createAudio90Instrument({
    oscillator: { wave: 'pulse', pulseWidth: 0.3 },
    filter: { cutoffHz: 2500, resonance: 0.2 },
    envelope: { attackMs: 200, decayMs: 0, sustain: 1, releaseMs: 600 },
    lfo: { shape: 'triangle', rateHz: 0.6, pitch: 4 },
    volume: 0.2,
    echo: 0.4,
    reverb: 0.4,
});

// ---------------------------------------------------------------------------
// Ambient house
// ---------------------------------------------------------------------------

/** A dreamy electric piano: a soft tine over a warm body, swaying slowly between the speakers. */
export const DREAM_KEYS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 3, decayMs: 2600, sustain: 0.25, releaseMs: 900 } },
        { level: 0.22, velocity: 0.8, envelope: { attackMs: 0, decayMs: 1200, sustain: 0.1, releaseMs: 400 } },
        { level: 0.5, detuneCents: 6, envelope: { attackMs: 3, decayMs: 1800, sustain: 0.15, releaseMs: 900 } },
        { ratio: 14, level: 0.07, velocity: 1, envelope: { attackMs: 0, decayMs: 110, sustain: 0, releaseMs: 50 } },
    ],
    rateScaling: 0.3,
    envelope: { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 900 },
    lfo: { rateBeats: 2, pan: 0.6, isRetriggered: false },
    volume: 0.56,
    chorus: 0.5,
    reverb: 0.5,
});

/** A hazy pad: six saws spread wide, swelling in slowly, under a filter that drifts open and shut. */
export const HAZE_PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 6, detune: 0.12, spread: 1 },
    filter: { cutoffHz: 1100, resonance: 0.1, keyTrack: 0.3 },
    lfo: { rateHz: 0.08, cutoff: 0.8, isRetriggered: false },
    envelope: { attackMs: 2200, decayMs: 1000, sustain: 0.9, releaseMs: 3000 },
    volume: 0.28,
    chorus: 0.6,
    reverb: 0.7,
});

/** A soft arpeggio: an FM modulator at the note, struck and fading, under a gentle filter, its brightness drifting. */
export const SOFT_ARP = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 6, decayMs: 380, sustain: 0, releaseMs: 200 } },
        { level: 0.35, envelope: { attackMs: 0, decayMs: 160, sustain: 0.1, releaseMs: 100 } },
    ],
    filter: { mode: 'lowpass12', cutoffHz: 1800 },
    lfo: { rateHz: 0.05, brightness: 0.3, isRetriggered: false },
    envelope: { attackMs: 6, decayMs: 0, sustain: 1, releaseMs: 200 },
    volume: 0.6,
    echo: 0.6,
    reverb: 0.4,
});

/** A deep, round bass: a triangle over a soft sub, gliding between notes that touch. */
export const DEEP_BASS = createAudio90Instrument({
    oscillator: { wave: 'triangle' },
    sub: 0.35,
    filter: { cutoffHz: 420, keyTrack: 0.3 },
    envelope: { attackMs: 8, decayMs: 600, sustain: 0.75, releaseMs: 180 },
    legato: { glideMs: 90 },
    volume: 0.7,
});

/** A dreamy lead: two warm saws under a gentle filter, slow to speak, gliding, a slow vibrato once held. */
export const DREAM_LEAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 2, detune: 0.05, spread: 0.5 },
    filter: { cutoffHz: 1400, resonance: 0.2, keyTrack: 0.5 },
    envelope: { attackMs: 90, decayMs: 800, sustain: 0.8, releaseMs: 900 },
    legato: { glideMs: 140 },
    vibrato: { semitones: 0.12, hz: 4.5, delayMs: 500 },
    volume: 0.18,
    echo: 0.5,
    reverb: 0.6,
    chorus: 0.3,
});

/** Wind: white noise through a ringing band, swept slowly up and down. */
export const AIR = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 900, resonance: 0.5 },
    lfo: { rateHz: 0.11, cutoff: 1.5, isRetriggered: false },
    envelope: { attackMs: 3000, decayMs: 0, sustain: 1, releaseMs: 3000 },
    volume: 0.27,
    reverb: 0.6,
});

/** A soft, deep kick: a sine falling two octaves, and a long body. */
export const SOFT_KICK = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 50, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 1, decayMs: 520, sustain: 0, releaseMs: 60 },
    note: 'A-1',
    volume: 0.95,
});
