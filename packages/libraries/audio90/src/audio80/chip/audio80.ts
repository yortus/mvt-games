import type { SoundChip } from '../../shared';
import type { Audio80EchoSetting, Audio80FilterId, Audio80FilterSetting, Audio80FilterSettingValue, Audio80VoiceSetting, Audio80VoiceSettingValue } from '../synthesiser';
import type { Audio80Song, Audio80Sound } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio80 is an eight-voice sound chip in the spirit of the sound chips
 * in 1980s home computers. It plays songs, on a sequencer of its own, and
 * sounds over them, and can be paused and turned down, as `SoundChip`
 * describes.
 *
 * Its setters, such as `setFilter`, play as soon as they can, or at `atMs`,
 * the chip time to apply them at, in ms, for code that schedules ahead. A
 * write stamped earlier than the chip has already played applies at once. In
 * a browser, the chip's time is the sound card's, and stands still while the
 * chip is paused. A headless chip has no sound card, so its time moves only
 * as the code that owns it says.
 *
 * `play` takes its options as an object. The code that plays a sound calls
 * it only as something happens, such as a shot being fired, so making the
 * object costs nothing that matters. The setters take their arguments in
 * order.
 */
export interface Audio80 extends SoundChip<Audio80Song, Audio80Sound, Audio80PlayOptions>, Omit<Audio80Writer, 'noteOn' | 'noteOff' | 'releaseAll'> {}

/** How one play of a sound differs from the sound's own settings. Each option defaults to the sound's. */
export interface Audio80PlayOptions {
    /** The note to play, as a name such as `'E-5'`, or a note number, where 60 is middle C. */
    readonly note?: string | number;
    /** A note to glide to over the play's length, as a name or a number. */
    readonly glideTo?: string | number;
    /** How long it holds its note before releasing it, in ms, above 0. `Infinity` holds it until `stop`. */
    readonly lengthMs?: number;
    /** A volume for this play, 0 or more, which scales the sound's own. Defaults to 1. */
    readonly volume?: number;
}

/**
 * What writes notes and settings to an Audio80, and its clock. A song's
 * writes need no more of a chip than this.
 */
export interface Audio80Writer {
    /**
     * The chip's time now, in ms. In a browser, it is the sound card's time
     * since the chip first played, less the time it spent paused. On a
     * headless chip, it is the sum of the deltas its `update` has moved it
     * on by.
     */
    readonly time: number;
    /** How many voices the chip has, which is 8. */
    readonly voiceCount: number;
    /**
     * Starts `note` on `voice` with `sound`. `note` is a note number, where
     * 60 is middle C, and `voice` is from 0 to 7. At a `volume` of 1, the
     * note plays at the sound's own volume. The note starts at chip time
     * `atMs`, in ms, or as soon as it can without it. If the chip has already
     * played past `atMs`, the note starts at once.
     */
    noteOn: (voice: number, sound: Audio80Sound, note: number, volume: number, atMs?: number) => void;
    /** Releases `voice`'s note at `atMs`. Its envelope starts its release, which fades the note out. */
    noteOff: (voice: number, atMs?: number) => void;
    /**
     * Sets one of `voice`'s settings to `value` at `atMs`. The value is a
     * `Audio80Wave` for `'wave'`, such as `'pulse'` or `'saw+pulse'`, and a number
     * for the rest. `Audio80VoiceSetting` gives each setting's range.
     */
    setVoice: <S extends Audio80VoiceSetting>(voice: number, setting: S, value: Audio80VoiceSettingValue<S>, atMs?: number) => void;
    /**
     * Sets one of filter `filter`'s settings to `value` at `atMs`. The value
     * is a `Audio80FilterMode` for `'mode'`, such as `'lowpass'` or `'notch'`, and a
     * number for the rest. `Audio80FilterSetting` gives each setting's range.
     */
    setFilter: <S extends Audio80FilterSetting>(filter: Audio80FilterId, setting: S, value: Audio80FilterSettingValue<S>, atMs?: number) => void;
    /** Sets one of the echo's settings to `value` at `atMs`. `Audio80EchoSetting` gives each setting's range. */
    setEcho: (setting: Audio80EchoSetting, value: number, atMs?: number) => void;
    /** Keeps voices 0 to `count` - 1 for music from `atMs`. Sounds played on their own play only on the rest. */
    reserveVoices: (count: number, atMs?: number) => void;
    /** Releases every voice, music and sounds alike, as soon as it can. `stop` with no id calls it. */
    releaseAll: () => void;
}
