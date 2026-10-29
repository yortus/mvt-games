// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The Audio80's own commands. Each is laid out as `COMMAND_STRIDE`, in the
// shared folder, describes: an opcode, a stamp, and four operands. The
// commands every chip has, such as `OP_NOTE_ON`, are in the shared folder.
// A voice's settings, for `OP_SET_VOICE`, are numbered here.

/** Voices on the chip, numbered from 0. */
export const AUDIO80_VOICE_COUNT = 4;

/**
 * Sets one of a filter's settings. `a` is the filter (0 or 1), `b` the
 * setting's index in `AUDIO80_FILTER_SETTING_INDEX`, and `c` the value. For `mode`,
 * the value is its mode flags (`FILTER80_LOWPASS` and the rest).
 */
export const OP80_SET_FILTER = 4;
/** Sets one of the echo's settings. `a` is the setting's index in `AUDIO80_ECHO_SETTING_INDEX`, and `b` the value. */
export const OP80_SET_ECHO = 5;

/** A setting of one voice that can be written directly. */
export type Audio80VoiceSetting =
    /**
     * 0 to 1, as in `Audio80SoundData.pulseWidth`. For a lone pulse, it is the
     * share of each cycle spent on one level. In a combined wave, it is where
     * in each cycle the pulse starts letting the other waves through. Setting
     * it stops the sound's pulse sweep for the note.
     */
    | 'pulseWidth'
    /** The note's volume, 0 or more. 1 plays it as written, and above 1 lifts a quiet sound. */
    | 'volume'
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
    | 'glide';

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

/** A setting of the echo that can be written directly. */
export type Audio80EchoSetting =
    /** The delay between repeats, in ms, from one sample to 1000 ms. */
    | 'timeMs'
    /** How much of each repeat is fed back into the next, from 0 to 0.95. */
    | 'feedback'
    /** How loud the echo is, from 0 to 1. */
    | 'level';

/** Each voice setting's number in an `OP_SET_VOICE` command. */
export const AUDIO80_VOICE_SETTING_INDEX: Readonly<Record<Audio80VoiceSetting, number>> = {
    pulseWidth: 0,
    volume: 1,
    arpeggio: 2,
    vibratoDepth: 3,
    vibratoRate: 4,
    slide: 5,
    glide: 6,
};

/** Each filter setting's number in an `OP80_SET_FILTER` command. */
export const AUDIO80_FILTER_SETTING_INDEX: Readonly<Record<Audio80FilterSetting, number>> = {
    mode: 0,
    cutoffHz: 1,
    resonance: 2,
    drive: 3,
};

/** Each echo setting's number in an `OP80_SET_ECHO` command. */
export const AUDIO80_ECHO_SETTING_INDEX: Readonly<Record<Audio80EchoSetting, number>> = {
    timeMs: 0,
    feedback: 1,
    level: 2,
};
