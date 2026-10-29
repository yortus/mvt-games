// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The Audio90's own commands. Each is laid out as `COMMAND_STRIDE`, in the
// shared folder, describes: an opcode, a stamp, and four operands. The
// commands every chip has, such as `OP_NOTE_ON`, are in the shared folder.
// A voice's settings, for `OP_SET_VOICE`, are numbered here.

/** Voices on the chip, numbered from 0. */
export const AUDIO90_VOICE_COUNT = 16;

/**
 * Sets one of an effect's settings. `a` is the effect's index in
 * `AUDIO90_EFFECT_INDEX`, `b` the setting's index in that effect's
 * settings, and `c` the value.
 */
export const OP90_SET_EFFECT = 4;
/** Sets how the chip sounds. `a` is the character's index in `AUDIO90_CHARACTERS`. */
export const OP90_SET_CHARACTER = 9;
/**
 * Sets the tempo, for LFOs and echoes timed in beats. `a` is the beats a
 * minute. 0 holds the LFOs timed in beats, as for a song held still, and the
 * echo keeps the last tempo above 0.
 */
export const OP90_SET_TEMPO = 10;

/** A setting of one voice that can be written directly. */
export type Audio90VoiceSetting =
    /** The note's volume, 0 or more. 1 plays it as written. */
    | 'volume'
    /** -1 (left) to 1 (right). */
    | 'pan'
    /**
     * 0 to 1, where 1 is the sound as written. Lower values close an
     * analog or sample voice's filter, and soften an FM voice's modulators.
     */
    | 'brightness'
    /** How much of the voice goes to the reverb, from 0 to 1. */
    | 'reverbSend'
    /** How much of the voice goes to the echo, from 0 to 1. */
    | 'echoSend'
    /** How much of the voice goes to the chorus, from 0 to 1. */
    | 'chorusSend'
    /** Two semitone offsets from 0 to 15, packed as `x * 16 + y`, played in turn. 0 stops the arpeggio. */
    | 'arpeggio'
    /** The vibrato's depth in semitones each way. Setting it starts the vibrato at once. */
    | 'vibratoDepth'
    /** The vibrato's rate in Hz. */
    | 'vibratoRate'
    /** Slides the pitch by this many semitones a second, until the next note. */
    | 'slide'
    /** Glides the pitch from the previous note to the current one over this many ms. */
    | 'glide'
    /**
     * An analog voice's chord: two semitone offsets from 0 to 15, packed as
     * `x * 16 + y`, played at once with the note. 0 stops the chord.
     */
    | 'chord'
    /** The slice of its sample that a sample voice plays, from 0. */
    | 'slice'
    /** 1 to accent the note playing: an analog voice's filter opens further, and the note plays louder. */
    | 'accent'
    /** An analog voice's pulse width, from 0 to 1. */
    | 'pulseWidth';

/** The shared effects, by name. */
export type Audio90EffectId = 'reverb' | 'echo' | 'chorus' | 'pump';

/** Each effect's settings. */
export interface Audio90EffectSettings {
    /** `size` 0 to 1, `decayMs`, `damping` 0 to 1 (how fast the highs fade), and `level` 0 to 1. */
    readonly reverb: 'size' | 'decayMs' | 'damping' | 'level';
    /**
     * `timeMs`, or `timeBeats` above 0 to follow the tempo; `feedback` 0 to
     * 0.95; `toneHz`, a low-pass filter on each repeat; `pingPong` 1 for
     * repeats that alternate sides; and `level` 0 to 1.
     */
    readonly echo: 'timeMs' | 'timeBeats' | 'feedback' | 'toneHz' | 'pingPong' | 'level';
    /** `depth` 0 to 1, `rateHz`, and `level` 0 to 1. */
    readonly chorus: 'depth' | 'rateHz' | 'level';
    /**
     * The pump ducks every voice playing music but one, each time that one
     * starts a note. `voice` is that voice, or -1 for no pump. `depth` 0 to 1,
     * and `releaseMs` is how long the mix takes to come back.
     */
    readonly pump: 'voice' | 'depth' | 'releaseMs';
}

/** One of an effect's settings. */
export type Audio90EffectSetting<E extends Audio90EffectId> = Audio90EffectSettings[E];

/**
 * How much grit survives the output stage. `studio` is clean. `console`
 * rounds FM voices to 9 bits, with a small step where the wave crosses zero,
 * and dulls samples a little. `sampler` plays samples with no smoothing and
 * drives the output a little harder.
 */
export type Audio90Character = 'studio' | 'console' | 'sampler';

/** Each voice setting's number in an `OP_SET_VOICE` command. */
export const AUDIO90_VOICE_SETTING_INDEX: Readonly<Record<Audio90VoiceSetting, number>> = {
    volume: 0,
    pan: 1,
    brightness: 2,
    reverbSend: 3,
    echoSend: 4,
    chorusSend: 5,
    arpeggio: 6,
    vibratoDepth: 7,
    vibratoRate: 8,
    slide: 9,
    glide: 10,
    chord: 11,
    slice: 12,
    accent: 13,
    pulseWidth: 14,
};

/** Each effect's number in an `OP90_SET_EFFECT` command. */
export const AUDIO90_EFFECT_INDEX: Readonly<Record<Audio90EffectId, number>> = { reverb: 0, echo: 1, chorus: 2, pump: 3 };

/** Each effect's settings' numbers in an `OP90_SET_EFFECT` command. */
export const AUDIO90_EFFECT_SETTING_INDEX: { readonly [E in Audio90EffectId]: Readonly<Record<Audio90EffectSetting<E>, number>> } = {
    reverb: { size: 0, decayMs: 1, damping: 2, level: 3 },
    echo: { timeMs: 0, timeBeats: 1, feedback: 2, toneHz: 3, pingPong: 4, level: 5 },
    chorus: { depth: 0, rateHz: 1, level: 2 },
    pump: { voice: 0, depth: 1, releaseMs: 2 },
};

/** The characters, at their numbers in an `OP90_SET_CHARACTER` command. */
export const AUDIO90_CHARACTERS: readonly Audio90Character[] = ['studio', 'console', 'sampler'];
