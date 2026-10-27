import type { AudioControls, SongSlot } from '../../shared';
import type { Audio90Character, Audio90EffectId, Audio90EffectSetting, Audio90VoiceSetting } from '../synthesiser';
import type { Audio90Song, Audio90Sound } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio90 is a sixteen-voice stereo sound chip in the spirit of the
 * synthesisers, samplers and game consoles of the 1990s. A game's views see
 * it as an output, like a renderer. An audio view writes to it each time the
 * view refreshes.
 *
 * Its clock works as the Audio80's does. A write plays as soon as it can.
 * Most writes also take `atMs`, the chip time to apply the write at, in ms,
 * for code that schedules its notes ahead. A write stamped earlier than the
 * chip has already played applies at once. In a browser, the chip's time is
 * the sound card's, and stands still while the chip is paused. A headless
 * chip has no sound card, so its time moves only as the code that owns it
 * says. The chip's pausing, volumes and resets belong to the code that owns
 * it, through the `AudioControls` made alongside the chip.
 *
 * `play` takes its options as an object. The code that plays a sound calls
 * it only as something happens, such as a shot being fired, so making the
 * object costs nothing that matters. The setters take their arguments in
 * order.
 *
 * It can also report what each voice is playing, for a scope to draw.
 */
export interface Audio90 extends Omit<Audio90Writer, 'noteOn' | 'noteOff'> {
    /**
     * Plays `sound` now, on a voice the chip chooses from those the music
     * does not keep. It picks a free voice if there is one. If not, it takes
     * the voice of the oldest sound whose priority is no higher than this
     * one's. If there is none, the sound doesn't play.
     *
     * It returns the play's id, which `stop` takes. A play with a
     * `lengthMs` of `Infinity` holds its note until it is stopped.
     */
    play: (sound: Audio90Sound, options?: Audio90PlayOptions) => number;
    /**
     * Releases the note of the play with id `id`, so it fades out as its
     * envelope's release says. It does nothing if the play has already ended,
     * or another sound has taken its voice.
     */
    stop: (id: number) => void;
    /**
     * The chip time, in ms, of the sound reaching the speaker now. In a
     * browser, it trails `time` by the sound card's latency. A view that shows the music as it is heard, as a tracker
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
 * writes, and a sample's bounce, need no more of a chip than this.
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
    /** Keeps voices 0 to `count` - 1 for music from `atMs`. Sounds played on their own play only on the rest. */
    reserveVoices: (count: number, atMs?: number) => void;
    /** Releases every voice, music and sounds alike, as soon as it can. */
    releaseAll: () => void;
}

/**
 * An Audio90 and its controls, as each of its factories makes them. The chip
 * is for the code that plays sounds, such as a game's views, and the
 * controls are for the code that owns the chip. A headless chip's controls
 * are `HeadlessControls`, which also move its clock on.
 */
export interface Audio90WithControls<A extends Audio90 = Audio90, C extends AudioControls = AudioControls> {
    /** The chip, which the code that plays sounds plays on. */
    readonly audio90: A;
    /** The chip's controls, which only the code that owns the chip uses. */
    readonly controls: C;
}
