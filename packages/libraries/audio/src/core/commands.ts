import type { EffectData, FilterMode, InstrumentData, Wave } from './instrument-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many numbers each command takes. Writes to the chip travel as commands
 * in a `Float64Array`, so writing one allocates nothing. Each command is
 * `[opcode, stampMs, a, b, c, d]`. The opcode says what the command does. The
 * stamp is the chip time the command applies at, in ms. A stamp of
 * `-Infinity` means as soon as possible.
 *
 * The synthesiser drops a command whose stamp is NaN or `+Infinity`. It also
 * drops one whose operands `a` to `d` are not all finite.
 */
export const COMMAND_STRIDE = 6;

/** Voices on the chip, numbered from 0. */
export const VOICE_COUNT = 8;

/** Starts a note. `a` is the voice, `b` the instrument id, `c` the note and `d` the volume. */
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
/** Plays an effect. `a` is the effect id. */
export const OP_PLAY_EFFECT = 6;
/** Releases every voice's note. No operands. */
export const OP_RELEASE_ALL = 7;
/**
 * Keeps voices for music. `a` is how many, counting up from voice 0. Effects
 * play only on the voices above them.
 */
export const OP_RESERVE_VOICES = 8;
/**
 * Sets a bus's gain. `a` is the bus (0 for music, 1 for effects), and `b` the
 * gain, from 0 to 2. The gain ramps to its new value over about 10 ms.
 */
export const OP_SET_MIX = 9;

/**
 * The two kinds of voice the listener sets a volume for: those playing an
 * effect, and the rest, which play music.
 */
export type MixBus = 'music' | 'effects';

/** A setting of one voice that can be written directly. */
export type VoiceSetting =
    /** A note number, which may be fractional for a bend. It changes the pitch without starting a note. */
    | 'note'
    /**
     * 0 to 1, as in `InstrumentData.pulseWidth`. For a lone pulse, it is the
     * share of each cycle spent on one level. In a combined wave, it is where
     * in each cycle the pulse starts letting the other waves through. Setting
     * it stops the instrument's pulse sweep for the note.
     */
    | 'pulseWidth'
    /** The note's volume, 0 or more. 1 plays it as written, and above 1 lifts a quiet instrument. */
    | 'volume'
    /** How much of the voice goes to the echo, from 0 to 1. */
    | 'echoSend'
    /** 0 for no filter, 1 for filter `a`, 2 for filter `b`. */
    | 'filter'
    /** A `Wave`, by name: `'pulse'`, `'saw+pulse'` and the rest. */
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
export type FilterSetting =
    /** A `FilterMode`, by name: `'lowpass'`, `'notch'` and the rest. */
    | 'mode'
    /** The cutoff in Hz, held between 20 Hz and 0.45 times the sample rate. */
    | 'cutoffHz'
    /** 0 to 1. Higher values boost the frequencies near the cutoff. */
    | 'resonance'
    /** How hard the filter's input is driven into distortion, for growl, from 0 to 1. */
    | 'drive';

/**
 * The type of value a voice setting takes: a `Wave` for `'wave'`, and a
 * number for every other setting. A setting type that could be either, such
 * as a union of both kinds, takes no value. Narrow it first.
 */
export type VoiceSettingValue<S extends VoiceSetting> = [S] extends ['wave'] ? Wave : [S] extends [Exclude<VoiceSetting, 'wave'>] ? number : never;

/**
 * The type of value a filter setting takes: a `FilterMode` for `'mode'`, and
 * a number for every other setting. A setting type that could be either,
 * such as a union of both kinds, takes no value. Narrow it first.
 */
export type FilterSettingValue<S extends FilterSetting> = [S] extends ['mode'] ? FilterMode : [S] extends [Exclude<FilterSetting, 'mode'>] ? number : never;

/** A setting of the echo that can be written directly. */
export type EchoSetting =
    /** The delay between repeats, in ms, from one sample to 1000 ms. */
    | 'timeMs'
    /** How much of each repeat is fed back into the next, from 0 to 0.95. */
    | 'feedback'
    /** How loud the echo is, from 0 to 1. */
    | 'level';

/** Each voice setting's number in an `OP_SET_VOICE` command. */
export const VOICE_SETTING_INDEX: Readonly<Record<VoiceSetting, number>> = {
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
export const FILTER_SETTING_INDEX: Readonly<Record<FilterSetting, number>> = {
    mode: 0,
    cutoffHz: 1,
    resonance: 2,
    drive: 3,
};

/** Each echo setting's number in an `OP_SET_ECHO` command. */
export const ECHO_SETTING_INDEX: Readonly<Record<EchoSetting, number>> = {
    timeMs: 0,
    feedback: 1,
    level: 2,
};

/** The voice settings by number: the reverse of `VOICE_SETTING_INDEX`. */
export const VOICE_SETTINGS: readonly VoiceSetting[] = listNamesByIndex(VOICE_SETTING_INDEX);
/** The filter settings by number: the reverse of `FILTER_SETTING_INDEX`. */
export const FILTER_SETTINGS: readonly FilterSetting[] = listNamesByIndex(FILTER_SETTING_INDEX);
/** The echo settings by number: the reverse of `ECHO_SETTING_INDEX`. */
export const ECHO_SETTINGS: readonly EchoSetting[] = listNamesByIndex(ECHO_SETTING_INDEX);

/**
 * A message the main thread sends the worklet. A `batch` carries one frame's
 * commands and the newest chip time. An `instrument` or `effect` message
 * carries one the first time it is played. A `reset` clears the chip so the
 * next game starts fresh.
 */
export type ChipMessage =
    | { readonly kind: 'batch'; readonly commands: Float64Array; readonly count: number; readonly horizonMs: number }
    | { readonly kind: 'instrument'; readonly id: number; readonly data: InstrumentData }
    | { readonly kind: 'effect'; readonly id: number; readonly data: EffectData }
    | { readonly kind: 'reset' };

/** What the worklet sends back: a batch's buffer, so the main thread can write into it again. */
export type ChipReply = { readonly kind: 'buffer'; readonly commands: Float64Array };

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The names of an index record, each at its index. */
function listNamesByIndex<T extends string>(indices: Readonly<Record<T, number>>): T[] {
    const names: T[] = [];
    for (const name of Object.keys(indices) as T[]) names[indices[name]] = name;
    return names;
}
