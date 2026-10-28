import type { SoundChip } from '../../shared';
import type { Audio90Character, Audio90EffectId, Audio90EffectSetting, Audio90VoiceSetting } from '../synthesiser';
import type { Audio90Song, Audio90Sound } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio90 is a sixteen-voice stereo sound chip in the spirit of the
 * synthesisers, samplers and game consoles of the 1990s. It plays songs, on
 * a sequencer of its own, and sounds, and can be paused and turned down, as
 * `SoundChip` describes. Every play starts as soon as it reaches the chip,
 * as on the Audio80.
 *
 * It can also report what each voice is playing, for a scope to draw. The
 * scope's layout is in `audio90/tracker`, with the other helpers an editor
 * needs.
 */
export interface Audio90 extends SoundChip<Audio90Song, Audio90Sound, Audio90PlayOptions> {
    /**
     * What each voice played last, while scopes are on, for a view to draw:
     * `AUDIO90_SCOPE_POINTS` points a voice, round and round, then each
     * voice's pan from `AUDIO90_SCOPE_PANS`, from -1 (left) to 1 (right). It
     * is the same array for the chip's life, filled about 90 times a second.
     * While scopes are off, it holds zeros.
     */
    readonly scope: Float32Array;
    /**
     * Turns the scopes on or off. They are off until turned on. While on,
     * they cost the audio thread a little each block, and the page a copy of
     * `scope` about 90 times a second.
     */
    setScopes: (isOn: boolean) => void;
}

/** How one play of a sound differs from the sound's own settings. Each option defaults to the sound's. */
export interface Audio90PlayOptions {
    /** The note to play, as a name such as `'E-5'`, or a note number, where 60 is middle C. */
    readonly note?: string | number;
    /** A note to glide to over the play's length, as a name or a number. */
    readonly glideTo?: string | number;
    /** How long it holds its note before releasing it, in ms, above 0. `Infinity` holds it until `stop`. */
    readonly lengthMs?: number;
    /** A volume for this play, 0 or more, which scales the sound's own. Defaults to 1. */
    readonly volume?: number;
    /** Where it plays, from -1 (left) to 1 (right). */
    readonly pan?: number;
}

/**
 * What writes notes and settings to an Audio90, and its clock. A song's
 * writes, and a sample's bounce, need no more of a chip than this. It is the
 * chip's inside, as `Audio80Writer` is the Audio80's.
 */
export interface Audio90Writer {
    /** The chip's time now, in ms, as the Audio80's `time` describes. */
    readonly time: number;
    /** How many voices the chip has, which is 16. */
    readonly voiceCount: number;
    /**
     * Starts `note` on `voice` with `sound`. `note` is a note number, where
     * 60 is middle C, and `voice` is from 0 to 15. At a `volume` of 1, the
     * note plays at the sound's own volume.
     */
    noteOn: (voice: number, sound: Audio90Sound, note: number, volume: number, atMs?: number) => void;
    /** Releases `voice`'s note at `atMs`. Its envelopes start their release, which fades the note out. */
    noteOff: (voice: number, atMs?: number) => void;
    /** Sets one of `voice`'s settings to `value` at `atMs`. `Audio90VoiceSetting` gives each setting's range. */
    setVoice: (voice: number, setting: Audio90VoiceSetting, value: number, atMs?: number) => void;
    /**
     * Sets one of an effect's settings to `value` at `atMs`: the reverb's,
     * the echo's, the chorus's or the pump's. `Audio90EffectSettings` gives
     * each setting's range.
     */
    setEffect: <E extends Audio90EffectId>(effect: E, setting: Audio90EffectSetting<E>, value: number, atMs?: number) => void;
    /** Sets how the chip sounds from `atMs`. */
    setCharacter: (character: Audio90Character, atMs?: number) => void;
    /**
     * Sets the tempo from `atMs`, in beats a minute, for the LFOs and the
     * echo timed in beats. 0 holds the LFOs timed in beats, as for a song held
     * still, and the echo keeps the last tempo above 0.
     */
    setTempo: (bpm: number, atMs?: number) => void;
    /** Releases every voice, music and sounds alike, as soon as it can. `stop` with no id calls it. */
    releaseAll: () => void;
}
