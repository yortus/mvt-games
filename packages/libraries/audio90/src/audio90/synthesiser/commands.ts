import type { ChipBatch } from '../../shared';
import type { Audio90SoundData, Audio90SampleData } from './sound-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The Audio90's commands. Each is laid out as `COMMAND_STRIDE`, in the
// shared folder, describes: an opcode, a stamp, and four operands.

/** Voices on the chip, numbered from 0. */
export const AUDIO90_VOICE_COUNT = 16;

/** How many points of each voice a scope keeps. */
export const AUDIO90_SCOPE_POINTS = 64;

/**
 * How many samples apart a scope's points are: one every eighth sample, so a
 * scope shows 512 samples, about 11 ms at 48 kHz, long enough for a cycle of
 * a bass note.
 */
export const AUDIO90_SCOPE_STRIDE = 8;

/** Where a scope's pans start: voice v's pan is at `AUDIO90_SCOPE_PANS + v`. */
export const AUDIO90_SCOPE_PANS = AUDIO90_VOICE_COUNT * AUDIO90_SCOPE_POINTS;

/** How many numbers a scope holds: each voice's points, then each voice's pan. */
export const AUDIO90_SCOPE_LENGTH = AUDIO90_SCOPE_PANS + AUDIO90_VOICE_COUNT;

/** Starts a note. `a` is the voice, `b` the sound's id, `c` the note and `d` the volume. */
export const OP90_NOTE_ON = 1;
/** Releases a voice's note. `a` is the voice. */
export const OP90_NOTE_OFF = 2;
/** Sets one of a voice's settings. `a` is the voice, `b` the setting's index in `AUDIO90_VOICE_SETTING_INDEX`, and `c` the value. */
export const OP90_SET_VOICE = 3;
/**
 * Sets one of an effect's settings. `a` is the effect's index in
 * `AUDIO90_EFFECT_INDEX`, `b` the setting's index in that effect's
 * settings, and `c` the value.
 */
export const OP90_SET_EFFECT = 4;
/**
 * Plays a sound on a voice the chip chooses. `a` is the sound's id, `b` the
 * play's id, `c` the note and `d` the volume. The `OP90_PLAY_OPTIONS` written
 * just before it says how long it lasts, where it glides and where it sits.
 */
export const OP90_PLAY = 5;
/** Releases every voice's note. No operands. */
export const OP90_RELEASE_ALL = 6;
/** Keeps voices for music. `a` is how many, counting up from voice 0. Sounds played on their own play only on the voices above them. */
export const OP90_RESERVE_VOICES = 7;
/** Sets a bus's gain. `a` is the bus (0 for music, 1 for sounds played on their own), and `b` the gain, from 0 to 2. It ramps over about 10 ms. */
export const OP90_SET_MIX = 8;
/** Sets how the chip sounds. `a` is the character's index in `AUDIO90_CHARACTERS`. */
export const OP90_SET_CHARACTER = 9;
/**
 * Sets the tempo, for LFOs and echoes timed in beats. `a` is the beats a
 * minute. 0 holds the LFOs timed in beats, as for a song held still, and the
 * echo keeps the last tempo above 0.
 */
export const OP90_SET_TEMPO = 10;
/**
 * Says how the next `OP90_PLAY` plays. `a` is how long it holds its note
 * before releasing it, in ms, or -1 to hold it until it is stopped. `b` is
 * the note it glides to over that time, or -1 for none. `c` is where it
 * sits, from -1 (left) to 1 (right), which is used when `d` is 1. When `d`
 * is 0, it sits at the sound's own pan. A play always writes one just before
 * its `OP90_PLAY`, with the same stamp.
 */
export const OP90_PLAY_OPTIONS = 11;
/** Releases the note of a play, if it is still sounding. `a` is the play's id. */
export const OP90_STOP = 12;

/** A setting of one voice that can be written directly. */
export type Audio90VoiceSetting =
    /** A note number, which may be fractional for a bend. It changes the pitch without starting a note. */
    | 'note'
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

/** Each voice setting's number in an `OP90_SET_VOICE` command. */
export const AUDIO90_VOICE_SETTING_INDEX: Readonly<Record<Audio90VoiceSetting, number>> = {
    note: 0,
    volume: 1,
    pan: 2,
    brightness: 3,
    reverbSend: 4,
    echoSend: 5,
    chorusSend: 6,
    arpeggio: 7,
    vibratoDepth: 8,
    vibratoRate: 9,
    slide: 10,
    glide: 11,
    chord: 12,
    slice: 13,
    accent: 14,
    pulseWidth: 15,
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

/**
 * A message the main thread sends the Audio90's worklet. A `batch` carries
 * commands. A `sound` message carries a sound, and a `sample` message a
 * sample, the first time it is played, before the commands that use it. A
 * `reset` clears the chip so the next game starts fresh.
 */
export type Audio90ChipMessage =
    | ChipBatch
    | { readonly kind: 'sound'; readonly id: number; readonly data: Audio90SoundData }
    | { readonly kind: 'sample'; readonly id: number; readonly data: Audio90SampleData }
    | { readonly kind: 'reset' };
