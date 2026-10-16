// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A voice's waveform. It is one of the four basic shapes, a combination of
 * them, or the voice's wavetable. A combination ANDs the shapes' bits
 * together, which gives a thin, metallic tone. Noise combines with nothing,
 * because on the chips this imitates, combining it silenced the voice.
 */
export type Wave =
    | 'triangle'
    | 'saw'
    | 'pulse'
    | 'noise'
    | 'wavetable'
    | 'triangle+saw'
    | 'triangle+pulse'
    | 'saw+pulse'
    | 'triangle+saw+pulse';

/** One of the chip's two filters. */
export type FilterId = 'a' | 'b';

/**
 * Which of a filter's outputs are heard. A low-pass output keeps the
 * frequencies below the filter's cutoff, and a high-pass output keeps those
 * above it. A band-pass output keeps those near the cutoff. A mode may
 * combine outputs, and low and high pass together make a notch.
 */
export type FilterMode = 'lowpass' | 'bandpass' | 'highpass' | 'notch' | 'lowpass+bandpass' | 'bandpass+highpass';

/**
 * How much grit survives the output stage. `clean` oscillators are band
 * limited at full resolution. `classic` ones are band limited and rounded to
 * 12 bits. `raw` ones alias freely, and each voice is rounded to 8 bits.
 *
 * Aliasing is the harsh, false tones that sharp jumps in a wave make once it
 * is sampled. Band limiting smooths the jumps in the saw and pulse waves so
 * they do not alias. It does not cover combined waves, noise, wavetables,
 * ring modulation or hard-synced voices, whose jumps alias in every
 * character.
 */
export type Character = 'clean' | 'classic' | 'raw';

/**
 * An instrument as plain numbers. It holds everything the chip's driver needs
 * to play the instrument, and it is all the chip is sent. Make one with
 * `createInstrument()`, never by hand.
 */
export interface InstrumentData {
    /** Waveform flags (`WAVE_TRIANGLE` and the rest). */
    readonly wave: number;
    /**
     * The pulse's width, 0 to 1. A lone pulse spends `pulseWidth` of each
     * cycle on one level and the rest on the other. So a width w sounds the
     * same as 1 - w. A width of 0.5 is a square wave, and 0.25 and 0.75 sound
     * alike.
     *
     * In a combined wave such as `saw+pulse`, the pulse lets the other waves
     * through from `pulseWidth` of the way through each cycle to its end.
     * Before that, the voice sits at its lowest level.
     */
    readonly pulseWidth: number;
    /** `WAVETABLE_SIZE` levels from 0 to 15, played once per cycle, or empty for none. */
    readonly wavetable: readonly number[];
    /**
     * How long the envelope takes to rise from silence to full, in ms. The
     * envelope is the note's volume over time. 0 starts at full. A note
     * played over another rises from where that note's envelope is, at the
     * same rate.
     */
    readonly attackMs: number;
    /** How long the envelope takes to fall from full towards `sustain`, in ms. The gap between them falls 60 dB over this time. */
    readonly decayMs: number;
    /** The level the envelope holds after its decay, from 0 to 1, until the note is released. */
    readonly sustain: number;
    /** How long the envelope takes to fall 60 dB once the note is released, in ms. */
    readonly releaseMs: number;
    /** The instrument's volume, 0 or more. Each note's volume is multiplied by it. */
    readonly volume: number;
    /** 0 for no filter, 1 for filter `a`, 2 for `b`. */
    readonly filter: number;
    /** How much of the instrument goes to the echo, from 0 to 1. */
    readonly echo: number;
    /** The note it plays when a pattern names the instrument but no note. */
    readonly note: number;
    /** How long each step of `steps` and `arpeggio` lasts, in ms. 0 or less uses `DEFAULT_STEP_MS`. */
    readonly stepMs: number;
    /** The step table. One row applies per step from the start of the note, and the last row holds. */
    readonly steps: readonly StepData[];
    /**
     * The arpeggio's semitone offsets from the note. One plays per step, in a
     * cycle, so one voice sounds like a chord. Empty for none. At most
     * `MAX_ARPEGGIO` are played.
     */
    readonly arpeggio: readonly number[];
    /** The vibrato's depth in semitones, each way, or 0 for none. Vibrato is a regular wobble in pitch. */
    readonly vibratoSemitones: number;
    /** The vibrato's rate in Hz. */
    readonly vibratoHz: number;
    /** How long a note holds before its vibrato starts, in ms. */
    readonly vibratoDelayMs: number;
    /** How long the pulse width takes to sweep from `pulseWidth` to `pulseSweepTo`, in ms, or 0 for no sweep. */
    readonly pulseSweepMs: number;
    /** The pulse width the sweep ends at, 0 to 1. */
    readonly pulseSweepTo: number;
    /** Whether the pulse sweep goes back and forth for as long as the note plays, rather than once. */
    readonly isPulseSweepPingPong: boolean;
    /**
     * How long the filter's cutoff takes to sweep from `filterSweepFromHz` to
     * `filterSweepToHz`, in ms, or 0 for no sweep. The sweep moves evenly in
     * pitch.
     */
    readonly filterSweepMs: number;
    /** The cutoff the sweep starts at, in Hz. It must be above 0, or the sweep is off. */
    readonly filterSweepFromHz: number;
    /** The cutoff the sweep ends at, in Hz. It must be above 0, or the sweep is off. */
    readonly filterSweepToHz: number;
    /**
     * A voice index, or -1 for none. This voice's phase restarts each time
     * that voice's phase wraps, which is called hard sync. A voice's phase is
     * how far it is through the current cycle of its wave.
     */
    readonly syncSource: number;
    /** A voice index, or -1 for none. That voice ring-modulates this voice's triangle wave. */
    readonly ringSource: number;
}

/** One row of an instrument's step table. -1 leaves a setting as it is. */
export interface StepData {
    /** Waveform flags (`WAVE_TRIANGLE` and the rest), or -1. */
    readonly wave: number;
    /** Whether `pitch` is ignored, added to the note played, or played in its place. */
    readonly pitchMode: StepPitchMode;
    /** Semitones from the note played (relative), or a note number (absolute). */
    readonly pitch: number;
    /** 0 to 1, multiplied by the note's volume, or -1. */
    readonly volume: number;
    /** 0 to 1, as in `InstrumentData.pulseWidth`, or -1. Setting it stops the pulse sweep. */
    readonly pulseWidth: number;
    /** The cutoff of the instrument's filter, in Hz, or -1. */
    readonly cutoffHz: number;
}

/** How a step sets the pitch: not at all, as an offset from the note played, or as a note of its own. */
export type StepPitchMode = 'none' | 'relative' | 'absolute';

/** A sound effect as plain data: its instrument and how to play it. `createSoundEffect()` makes it. */
export interface EffectData {
    readonly instrument: InstrumentData;
    /** The note it starts on. */
    readonly note: number;
    /** A note to glide to over the effect's length, or NaN for none. */
    readonly glideTo: number;
    /** How long it plays before it is released, in ms. */
    readonly lengthMs: number;
    /** The volume of its note, 0 or more. */
    readonly volume: number;
    /** Higher wins. A new effect takes a playing effect's voice only if that effect's priority is equal or lower. */
    readonly priority: number;
    /** How many voices it may play on at once. If it is played again while on that many, it restarts the oldest of them. */
    readonly maxVoices: number;
}

/** The waveform flag for the triangle wave. */
export const WAVE_TRIANGLE = 1;
/** The waveform flag for the saw wave. */
export const WAVE_SAW = 2;
/** The waveform flag for the pulse wave. `pulseWidth` sets its width. */
export const WAVE_PULSE = 4;
/** The waveform flag for noise, pitched by the note. It combines with no other wave. */
export const WAVE_NOISE = 8;
/** The waveform flag for the voice's wavetable. It combines with no other wave. */
export const WAVE_TABLE = 16;

/** The filter mode flag for low pass. */
export const FILTER_LOWPASS = 1;
/** The filter mode flag for band pass. */
export const FILTER_BANDPASS = 2;
/** The filter mode flag for high pass. */
export const FILTER_HIGHPASS = 4;
/** Every `FilterMode`. A mode can be held as a number, which is its index here. */
export const FILTER_MODES: readonly FilterMode[] = ['lowpass', 'bandpass', 'highpass', 'notch', 'lowpass+bandpass', 'bandpass+highpass'];

/** How many levels a wavetable has. */
export const WAVETABLE_SIZE = 32;
/** How long a step lasts, in ms, when an instrument does not say. This gives 60 steps a second. */
export const DEFAULT_STEP_MS = 1000 / 60;
/** The most semitone offsets an instrument's arpeggio may have, which is as many as the chip holds. The chip ignores any more. */
export const MAX_ARPEGGIO = 16;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The waveform flags of a `Wave`. They come from a lookup table, so a write made every frame allocates nothing. */
export function toWaveFlags(wave: Wave): number {
    return WAVE_FLAGS[wave];
}

/** The mode flags of a `FilterMode`. They come from a lookup table, so a write made every frame allocates nothing. */
export function toFilterModeFlags(mode: FilterMode): number {
    return FILTER_MODE_FLAGS[mode];
}

/** A filter's route number (1 or 2), or 0 for none. */
export function toFilterRoute(filter: FilterId | undefined): number {
    return filter === undefined ? 0 : filter === 'a' ? 1 : 2;
}

/**
 * The cutoff, in Hz, of a filter level from 0 (closed) to 15 (open), as
 * music trackers write it. A tracker is music software that writes a song
 * as rows of notes. The levels run from 80 Hz to about 14.5 kHz, evenly in
 * pitch.
 */
export function toCutoff(level: number): number {
    return 80 * Math.pow(2, level / 2);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WAVE_FLAGS: Readonly<Record<Wave, number>> = {
    'triangle': WAVE_TRIANGLE,
    'saw': WAVE_SAW,
    'pulse': WAVE_PULSE,
    'noise': WAVE_NOISE,
    'wavetable': WAVE_TABLE,
    'triangle+saw': WAVE_TRIANGLE | WAVE_SAW,
    'triangle+pulse': WAVE_TRIANGLE | WAVE_PULSE,
    'saw+pulse': WAVE_SAW | WAVE_PULSE,
    'triangle+saw+pulse': WAVE_TRIANGLE | WAVE_SAW | WAVE_PULSE,
};

const FILTER_MODE_FLAGS: Readonly<Record<FilterMode, number>> = {
    'lowpass': FILTER_LOWPASS,
    'bandpass': FILTER_BANDPASS,
    'highpass': FILTER_HIGHPASS,
    'notch': FILTER_LOWPASS | FILTER_HIGHPASS,
    'lowpass+bandpass': FILTER_LOWPASS | FILTER_BANDPASS,
    'bandpass+highpass': FILTER_BANDPASS | FILTER_HIGHPASS,
};
