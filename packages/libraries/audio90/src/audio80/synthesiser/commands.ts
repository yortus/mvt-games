import type { ChipBatch } from '../../shared';
import type { Audio80FilterMode, SoundData, Audio80Wave } from './sound-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The Audio80's commands. Each is laid out as `COMMAND_STRIDE`, in the
// shared folder, describes: an opcode, a stamp, and four operands.

/** Voices on the chip, numbered from 0. */
export const VOICE_COUNT = 4;

/** Starts a note. `a` is the voice, `b` the sound's id, `c` the note and `d` the volume. */
export const OP_NOTE_ON = 1;
/** Releases a voice's note. `a` is the voice. */
export const OP_NOTE_OFF = 2;
/**
 * Sets one of a voice's settings. `a` is the voice, `b` the setting's index
 * in `VOICE_SETTING_INDEX`, and `c` the value. For `wave`, the value is its
 * waveform flags (`WAVE_TRIANGLE` and the rest).
 */
export const OP_SET_VOICE = 3;
/**
 * Sets one of a filter's settings. `a` is the filter (0 or 1), `b` the
 * setting's index in `FILTER_SETTING_INDEX`, and `c` the value. For `mode`,
 * the value is its mode flags (`FILTER_LOWPASS` and the rest).
 */
export const OP_SET_FILTER = 4;
/** Sets one of the echo's settings. `a` is the setting's index in `ECHO_SETTING_INDEX`, and `b` the value. */
export const OP_SET_ECHO = 5;
/**
 * Plays a sound on a voice the chip chooses. `a` is the sound's id, `b` the
 * play's id, `c` the note and `d` the volume. The `OP_PLAY_OPTIONS` written
 * just before it says how long it lasts and where it glides.
 */
export const OP_PLAY = 6;
/** Releases every voice's note. No operands. */
export const OP_RELEASE_ALL = 7;
/**
 * Says how the next `OP_PLAY` plays. `a` is how long it holds its note
 * before releasing it, in ms, or -1 to hold it until it is stopped. `b` is
 * the note it glides to over that time, or -1 for none. A play always
 * writes one just before its `OP_PLAY`, with the same stamp.
 */
export const OP_PLAY_OPTIONS = 10;
/** Releases the note of a play, if it is still sounding. `a` is the play's id. */
export const OP_STOP = 11;

/** A setting of one voice that can be written directly. */
export type Audio80VoiceSetting =
    /** A note number, which may be fractional for a bend. It changes the pitch without starting a note. */
    | 'note'
    /**
     * 0 to 1, as in `SoundData.pulseWidth`. For a lone pulse, it is the
     * share of each cycle spent on one level. In a combined wave, it is where
     * in each cycle the pulse starts letting the other waves through. Setting
     * it stops the sound's pulse sweep for the note.
     */
    | 'pulseWidth'
    /** The note's volume, 0 or more. 1 plays it as written, and above 1 lifts a quiet sound. */
    | 'volume'
    /** How much of the voice goes to the echo, from 0 to 1. */
    | 'echoSend'
    /** 0 for no filter, 1 for filter `a`, 2 for filter `b`. */
    | 'filter'
    /** A `Audio80Wave`, by name: `'pulse'`, `'saw+pulse'` and the rest. */
    | 'wave'
    /**
     * Two semitone offsets from 0 to 15, packed as `x * 16 + y`. Successive
     * steps play the note, the note plus `x`, then the note plus `y`, and
     * repeat. 0 stops the arpeggio.
     */
    | 'arpeggio'
    /** The vibrato's depth in semitones each way, 0 or more. Setting it starts the vibrato at once, with no delay. */
    | 'vibratoDepth'
    /** The vibrato's rate in Hz, 0 or more. */
    | 'vibratoRate'
    /** Slides the pitch up or down by this many semitones a second, from now until the next note. */
    | 'slide'
    /** Glides the pitch from the previous note to the current one over this many ms. */
    | 'glide'
    /** A voice index, or -1 for none. This voice's phase restarts each time that voice's phase wraps. */
    | 'syncSource'
    /** A voice index, or -1 for none. That voice ring-modulates this voice's triangle wave. */
    | 'ringSource';

/** A setting of one filter that can be written directly. */
export type Audio80FilterSetting =
    /** A `Audio80FilterMode`, by name: `'lowpass'`, `'notch'` and the rest. */
    | 'mode'
    /** The cutoff in Hz, held between 20 Hz and 0.45 times the sample rate. */
    | 'cutoffHz'
    /** 0 to 1. Higher values boost the frequencies near the cutoff. */
    | 'resonance'
    /** How hard the filter's input is driven into distortion, for growl, from 0 to 1. */
    | 'drive';

/**
 * The type of value a voice setting takes: a `Audio80Wave` for `'wave'`, and a
 * number for every other setting. A setting type that could be either, such
 * as a union of both kinds, takes no value. Narrow it first.
 */
export type Audio80VoiceSettingValue<S extends Audio80VoiceSetting> = [S] extends ['wave'] ? Audio80Wave : [S] extends [Exclude<Audio80VoiceSetting, 'wave'>] ? number : never;

/**
 * The type of value a filter setting takes: a `Audio80FilterMode` for `'mode'`, and
 * a number for every other setting. A setting type that could be either,
 * such as a union of both kinds, takes no value. Narrow it first.
 */
export type Audio80FilterSettingValue<S extends Audio80FilterSetting> = [S] extends ['mode'] ? Audio80FilterMode : [S] extends [Exclude<Audio80FilterSetting, 'mode'>] ? number : never;

/** A setting of the echo that can be written directly. */
export type Audio80EchoSetting =
    /** The delay between repeats, in ms, from one sample to 1000 ms. */
    | 'timeMs'
    /** How much of each repeat is fed back into the next, from 0 to 0.95. */
    | 'feedback'
    /** How loud the echo is, from 0 to 1. */
    | 'level';

/** Each voice setting's number in an `OP_SET_VOICE` command. */
export const VOICE_SETTING_INDEX: Readonly<Record<Audio80VoiceSetting, number>> = {
    note: 0,
    pulseWidth: 1,
    volume: 2,
    echoSend: 3,
    filter: 4,
    wave: 5,
    arpeggio: 6,
    vibratoDepth: 7,
    vibratoRate: 8,
    slide: 9,
    glide: 10,
    syncSource: 11,
    ringSource: 12,
};

/** Each filter setting's number in an `OP_SET_FILTER` command. */
export const FILTER_SETTING_INDEX: Readonly<Record<Audio80FilterSetting, number>> = {
    mode: 0,
    cutoffHz: 1,
    resonance: 2,
    drive: 3,
};

/** Each echo setting's number in an `OP_SET_ECHO` command. */
export const ECHO_SETTING_INDEX: Readonly<Record<Audio80EchoSetting, number>> = {
    timeMs: 0,
    feedback: 1,
    level: 2,
};

/** The voice settings by number: the reverse of `VOICE_SETTING_INDEX`. */
export const VOICE_SETTINGS: readonly Audio80VoiceSetting[] = listNamesByIndex(VOICE_SETTING_INDEX);
/** The filter settings by number: the reverse of `FILTER_SETTING_INDEX`. */
export const FILTER_SETTINGS: readonly Audio80FilterSetting[] = listNamesByIndex(FILTER_SETTING_INDEX);
/** The echo settings by number: the reverse of `ECHO_SETTING_INDEX`. */
export const ECHO_SETTINGS: readonly Audio80EchoSetting[] = listNamesByIndex(ECHO_SETTING_INDEX);

/**
 * A message the main thread sends the worklet. A `batch` carries commands. A
 * `sound` message carries a sound the first time it is played. A `reset`
 * clears the chip so the next game starts fresh.
 */
export type Audio80ChipMessage =
    | ChipBatch
    | { readonly kind: 'sound'; readonly id: number; readonly data: SoundData }
    | { readonly kind: 'reset' };

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The names of an index record, each at its index. */
function listNamesByIndex<T extends string>(indices: Readonly<Record<T, number>>): T[] {
    const names: T[] = [];
    for (const name of Object.keys(indices) as T[]) names[indices[name]] = name;
    return names;
}
