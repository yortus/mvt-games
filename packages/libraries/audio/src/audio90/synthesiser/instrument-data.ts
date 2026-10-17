import { DEFAULT_STEP_MS, type DriverStep } from '../../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 instrument as plain numbers. It holds everything the chip
 * needs to play the instrument, and it is all the chip is sent. The
 * notation makes it from an instrument's options. Each engine reads only its
 * own fields, and the rest keep their defaults.
 */
export interface Audio90InstrumentData {
    /** `ENGINE_FM`, `ENGINE_ANALOG` or `ENGINE_SAMPLE`. */
    readonly engine: number;
    /** The note it plays when a song names it with no note, as drums are. */
    readonly note: number;
    /** A gain on every note, 0 or more. */
    readonly volume: number;
    /** -1 (left) to 1 (right). */
    readonly pan: number;
    /** Its sends to the shared effects, each 0 to 1. */
    readonly reverb: number;
    readonly echo: number;
    readonly chorus: number;
    /** The volume envelope. */
    readonly envelope: Audio90EnvelopeData;

    /** The mod envelope, and how far it moves the pitch (semitones), the cutoff (octaves) and the brightness (0 to 1). */
    readonly modEnvelope: Audio90EnvelopeData;
    readonly modPitch: number;
    readonly modCutoff: number;
    readonly modBrightness: number;

    /** The LFO's shape, one of the `LFO_*` shapes. */
    readonly lfoShape: number;
    /** Its rate in Hz, used when `lfoBeats` is 0. */
    readonly lfoHz: number;
    /** Its cycle in beats of the tempo, or 0 to use `lfoHz`. A quarter is a sixteenth note at four rows a beat. */
    readonly lfoBeats: number;
    /** How long a note plays before the LFO moves it, in ms. */
    readonly lfoDelayMs: number;
    /** Whether each note starts the LFO's cycle again. If not, it runs free. */
    readonly isLfoRetriggered: boolean;
    /**
     * How far the LFO moves the pitch (semitones), the cutoff (octaves), the
     * brightness, the volume and the pan. The volume, 0 to 1, dips as the LFO
     * falls, so a square LFO is a gate that is open on the beat.
     */
    readonly lfoPitch: number;
    readonly lfoCutoff: number;
    readonly lfoBrightness: number;
    readonly lfoVolume: number;
    readonly lfoPan: number;

    /** The voice's filter, one of the `FILTER90_*` modes. */
    readonly filterMode: number;
    readonly cutoffHz: number;
    /** 0 to 1. Near 1, a 24 dB filter rings at its cutoff. */
    readonly resonance: number;
    /** How hard the filter's input is driven, 0 to 1. */
    readonly drive: number;
    /** How much the cutoff follows the note's pitch, 0 to 1. */
    readonly keyTrack: number;
    /** How much more an accented note opens the filter and lifts the volume, 0 to 1. */
    readonly accent: number;

    /** The driver's settings, as the Audio80's instruments have them. */
    readonly stepMs: number;
    readonly steps: readonly Audio90StepData[];
    readonly arpeggio: readonly number[];
    readonly vibratoSemitones: number;
    readonly vibratoHz: number;
    readonly vibratoDelayMs: number;
    /** A glide into each note, in ms, or 0 for none. */
    readonly glideMs: number;
    /** Whether a note glides, and keeps its envelopes running, only when it overlaps the one before, as an acid bass slides. */
    readonly isLegato: boolean;

    /** FM: for each operator, a mask of the operators that modulate it (bit j for operator j). */
    readonly algorithm: readonly number[];
    readonly operators: readonly Audio90OperatorData[];
    /** How much the highest operator modulates itself, 0 to 1. */
    readonly feedback: number;
    /** How much faster high notes' operators fade, 0 to 1. */
    readonly rateScaling: number;

    /** Analog: the oscillator's wave, one of the `WAVE90_*` waves. */
    readonly wave: number;
    /** How many copies of the oscillator, 1 to `MAX_UNISON`. */
    readonly unison: number;
    /** How far apart the copies are tuned, 0 to 1. */
    readonly detune: number;
    /** How far apart the copies are spread across the stereo field, 0 to 1. */
    readonly spread: number;
    /** Semitone offsets the copies play at once, as chord memory. Empty for none. */
    readonly chord: readonly number[];
    readonly pulseWidth: number;
    /** The second oscillator's interval from the first, in semitones, and its level, 0 for none. */
    readonly intervalB: number;
    readonly levelB: number;
    /** Whether the second oscillator restarts each time the first's cycle does: hard sync. */
    readonly isSyncedB: boolean;
    /** The sub oscillator's level, a square an octave down, 0 for none. */
    readonly sub: number;
    /** The noise's level, 0 for none. */
    readonly noise: number;

    /** Sample: the sample's id, and the note the sample sounds at its own rate, or NaN for the sample's own. */
    readonly sample: number;
    readonly rootNote: number;
    /** Whether the sample plays backwards. */
    readonly isReversed: boolean;
}

/** An envelope: attack, decay, sustain and release. */
export interface Audio90EnvelopeData {
    readonly attackMs: number;
    readonly decayMs: number;
    /** 0 to 1. A note that decays to 0 ends, and frees its voice. */
    readonly sustain: number;
    readonly releaseMs: number;
}

/** One FM operator. */
export interface Audio90OperatorData {
    /** Its frequency as a multiple of the note's. */
    readonly ratio: number;
    /** A fixed frequency in Hz in place of `ratio`, or 0. */
    readonly fixedHz: number;
    readonly detuneCents: number;
    /** Its level. A modulator's level sets how bright the sound is. */
    readonly level: number;
    /** One of the `OP_WAVE_*` waves. */
    readonly wave: number;
    /** How much velocity changes its level, 0 to 1. */
    readonly velocity: number;
    readonly envelope: Audio90EnvelopeData;
}

/** One row of an Audio90 step table. A value of -1 leaves its setting as it is; for `pan`, NaN does. */
export interface Audio90StepData extends DriverStep {
    readonly volume: number;
    readonly pan: number;
    readonly brightness: number;
    readonly slice: number;
    readonly wave: number;
}

/** A sound effect: an instrument, how to play it, and how it shares voices. */
export interface Audio90EffectData {
    readonly instrument: Audio90InstrumentData;
    readonly note: number;
    /** The note it glides to over its length, or NaN for none. */
    readonly glideTo: number;
    readonly lengthMs: number;
    readonly volume: number;
    /** Its pan, unless it is played with one. */
    readonly pan: number;
    readonly priority: number;
    readonly maxVoices: number;
}

/** A sample, and how it plays. */
export interface Audio90SampleData {
    /** Its samples, at its own rate. */
    readonly data: Int16Array;
    readonly sampleRate: number;
    /** The note it sounds when played at its own rate. */
    readonly rootNote: number;
    /** Its loop, in samples, or -1 for a one-shot. A sliced sample does not loop. */
    readonly loopStart: number;
    readonly loopEnd: number;
    /** Whether the loop goes back and forth. */
    readonly isPingPong: boolean;
    /** How many equal slices it is cut into, or 1 for none. */
    readonly slices: number;
}

export const ENGINE_FM = 0;
export const ENGINE_ANALOG = 1;
export const ENGINE_SAMPLE = 2;

export const WAVE90_SAW = 0;
export const WAVE90_PULSE = 1;
export const WAVE90_TRIANGLE = 2;
export const WAVE90_SINE = 3;

export const OP_WAVE_SINE = 0;
export const OP_WAVE_HALF_SINE = 1;
export const OP_WAVE_ABS_SINE = 2;
export const OP_WAVE_QUARTER_SINE = 3;

export const FILTER90_NONE = 0;
/** A four-pole ladder low-pass, which rings at its cutoff near full resonance. */
export const FILTER90_LOWPASS_24 = 1;
export const FILTER90_LOWPASS_12 = 2;
export const FILTER90_BANDPASS = 3;
export const FILTER90_HIGHPASS = 4;

export const LFO_SINE = 0;
export const LFO_TRIANGLE = 1;
export const LFO_SQUARE = 2;
export const LFO_SAW = 3;
/** A new random level each cycle. */
export const LFO_RANDOM = 4;

/** The most copies of an analog voice's oscillator. */
export const MAX_UNISON = 7;

/** The most FM operators a voice has. */
export const MAX_OPERATORS = 4;

/** An envelope that holds the note at full volume, and fades quickly when it is released. */
export const HELD_ENVELOPE: Audio90EnvelopeData = Object.freeze({ attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 });

/**
 * An instrument with every field at its default: a held sine, centred, with
 * no filter, sends, LFO or mod envelope. The notation starts from it.
 */
export const DEFAULT_AUDIO90_INSTRUMENT: Audio90InstrumentData = Object.freeze({
    engine: ENGINE_ANALOG,
    note: 60,
    volume: 1,
    pan: 0,
    reverb: 0,
    echo: 0,
    chorus: 0,
    envelope: HELD_ENVELOPE,
    modEnvelope: HELD_ENVELOPE,
    modPitch: 0,
    modCutoff: 0,
    modBrightness: 0,
    lfoShape: LFO_SINE,
    lfoHz: 5,
    lfoBeats: 0,
    lfoDelayMs: 0,
    isLfoRetriggered: true,
    lfoPitch: 0,
    lfoCutoff: 0,
    lfoBrightness: 0,
    lfoVolume: 0,
    lfoPan: 0,
    filterMode: FILTER90_NONE,
    cutoffHz: 20000,
    resonance: 0,
    drive: 0,
    keyTrack: 0,
    accent: 0,
    stepMs: DEFAULT_STEP_MS,
    steps: Object.freeze([]),
    arpeggio: Object.freeze([]),
    vibratoSemitones: 0,
    vibratoHz: 0,
    vibratoDelayMs: 0,
    glideMs: 0,
    isLegato: false,
    algorithm: Object.freeze([0, 0, 0, 0]),
    operators: Object.freeze([]),
    feedback: 0,
    rateScaling: 0,
    wave: WAVE90_SINE,
    unison: 1,
    detune: 0,
    spread: 0,
    chord: Object.freeze([]),
    pulseWidth: 0.5,
    intervalB: 0,
    levelB: 0,
    isSyncedB: false,
    sub: 0,
    noise: 0,
    sample: -1,
    rootNote: Number.NaN,
    isReversed: false,
});
