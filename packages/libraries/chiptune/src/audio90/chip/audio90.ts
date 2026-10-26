import type { AudioControls, SongSlot } from '../../shared';
import type { Audio90Character, Audio90EffectId, Audio90EffectSetting, Audio90VoiceSetting } from '../synthesiser';
import type { Audio90Instrument, Audio90Song, Audio90SoundEffect } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio90 is a sixteen-voice stereo sound chip in the spirit of the
 * synthesisers, samplers and game consoles of the 1990s. A game's views see
 * it as an output, like a renderer. An audio view writes to it each time the
 * view refreshes.
 *
 * Its clock works as the Audio80's does. Each write is stamped with a chip
 * time, and the chip plays it at that time. The clock moves only when the
 * game loop advances it, by the models' delta each tick, so the chip pauses
 * with the game. Effects are the exception, because they play as soon as
 * they arrive. The chip's clock, volumes and resets belong to the game loop,
 * through the `AudioControls` made alongside the chip.
 *
 * `atMs`, which most writes take last, is the chip time to apply the write
 * at, in ms. It defaults to `time`. A write stamped earlier than the chip has
 * already played applies at once.
 *
 * Its methods take their arguments in order rather than as an options
 * object, because views call them every refresh and they must not allocate.
 *
 * It can also report what each voice is playing, for a scope to draw.
 */
export interface Audio90 extends Audio90Writer {
    /**
     * The chip time, in ms, of the sound reaching the speaker now. In a
     * browser, it trails `time` by the chip's lead and the sound card's
     * latency. A view that shows the music as it is heard, as a tracker
     * does, reads it rather than `time`. A chip with no speaker hears each
     * write as it is made, so for it this is `time`.
     */
    readonly heardTime: number;
    /**
     * Opens a slot on the chip's own sequencer, which plays one song at a
     * time. In a browser, the sequencer runs on the audio thread, on the
     * sound card's clock, so a late frame never holds the music up. Most code
     * calls `createMusicPlayer`, which opens one.
     */
    readonly openSongSlot: () => SongSlot<Audio90Song>;
    /**
     * What each voice played last, while scopes are on, for a view to draw:
     * `AUDIO90_SCOPE_POINTS` points a voice, round and round, then each
     * voice's pan from `AUDIO90_SCOPE_PANS`, from -1 (left) to 1 (right). It
     * is the same array for the chip's life, filled about 90 times a second.
     * While scopes are off, it holds zeros.
     */
    readonly scope: Float32Array;
    /**
     * Turns the scopes on or off. They are off until turned on, and a reset
     * turns them off, so no entry pays for another's. While on, they cost
     * the audio thread a little each block, and the page a copy of `scope`
     * about 90 times a second.
     */
    setScopes: (isOn: boolean) => void;
}

/**
 * What writes to an Audio90: every call that plays or sets something, and
 * its clock. A song's writes, and a sample's bounce, need no more of a chip
 * than this.
 */
export interface Audio90Writer {
    /** The chip's clock, in ms. It is the sum of the deltas the game loop has advanced it by. */
    readonly time: number;
    /** How many voices the chip has, which is 16. */
    readonly voiceCount: number;
    /**
     * Plays `effect` now, on a voice the chip chooses from those the music
     * does not keep. It picks a free voice if there is one. If not, it takes
     * the voice of the oldest effect whose priority is no higher than this
     * one's. `pan` is from -1 (left) to 1 (right), and defaults to the
     * effect's own.
     */
    play: (effect: Audio90SoundEffect, pan?: number) => void;
    /**
     * Starts `note` on `voice` with `instrument`. `note` is a note number,
     * where 60 is middle C, and `voice` is from 0 to 15. At a `volume` of 1,
     * the note plays at the instrument's own volume.
     */
    noteOn: (voice: number, instrument: Audio90Instrument, note: number, volume: number, atMs?: number) => void;
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
    /** Keeps voices 0 to `count` - 1 for music from `atMs`. Effects play only on the rest. */
    reserveVoices: (count: number, atMs?: number) => void;
    /** Releases every voice, music and effects, at `time`. */
    releaseAll: () => void;
}

/** An Audio90 and its controls, as each of its factories makes them. The chip is for the game's views, and the controls are for the game loop. */
export interface Audio90WithControls<A extends Audio90 = Audio90> {
    /** The chip, which the game's views play on. */
    readonly audio90: A;
    /** The chip's controls, which only the game loop uses. */
    readonly controls: AudioControls;
}
