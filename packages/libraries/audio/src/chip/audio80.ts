import type { AudioControls } from './audio-controls';
import type { EchoSetting, FilterId, FilterSetting, FilterSettingValue, VoiceSetting, VoiceSettingValue } from '../core';
import type { Instrument, SoundEffect } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio80 is an eight-voice sound chip in the spirit of the sound chips
 * in 1980s home computers. A game's views see it as an output, like a
 * renderer. An audio view writes to it each time the view refreshes.
 *
 * Each write is stamped with a chip time, and the chip plays it at that
 * time. The chip's clock moves only when the game loop advances it, by the
 * models' delta each tick. So the chip never plays ahead of what it has been
 * told, and it pauses with the game. Effects are the exception, because they
 * play as soon as they arrive. The chip's clock, volumes and resets belong to
 * the game loop, through the `AudioControls` made alongside the chip.
 *
 * `atMs`, which most writes take last, is the chip time to apply the write
 * at, in ms. It defaults to `time`. A write stamped earlier than the chip has
 * already played applies at once.
 *
 * Its methods take their arguments in order rather than as an options
 * object, because views call them every refresh and they must not allocate.
 */
export interface Audio80 {
    /** The chip's clock, in ms. It is the sum of the deltas the game loop has advanced it by. */
    readonly time: number;
    /** How many voices the chip has, which is 8. */
    readonly voiceCount: number;
    /**
     * Plays `effect` now, on a voice the chip chooses from those the music
     * does not keep. It picks a free voice if there is one. If not, it takes
     * the voice of the oldest effect whose priority is no higher than this
     * one's.
     */
    play: (effect: SoundEffect) => void;
    /**
     * Starts `note` on `voice` with `instrument`. `note` is a note number,
     * where 60 is middle C, and `voice` is from 0 to 7. At a `volume` of 1,
     * the note plays at the instrument's own volume. The note starts at chip
     * time `atMs`, in ms, which defaults to `time`. If the chip has already
     * played past `atMs`, the note starts at once.
     */
    noteOn: (voice: number, instrument: Instrument, note: number, volume: number, atMs?: number) => void;
    /** Releases `voice`'s note at `atMs`. Its envelope starts its release, which fades the note out. */
    noteOff: (voice: number, atMs?: number) => void;
    /**
     * Sets one of `voice`'s settings to `value` at `atMs`. The value is a
     * `Wave` for `'wave'`, such as `'pulse'` or `'saw+pulse'`, and a number
     * for the rest. `VoiceSetting` gives each setting's range.
     */
    setVoice: <S extends VoiceSetting>(voice: number, setting: S, value: VoiceSettingValue<S>, atMs?: number) => void;
    /**
     * Sets one of filter `filter`'s settings to `value` at `atMs`. The value
     * is a `FilterMode` for `'mode'`, such as `'lowpass'` or `'notch'`, and a
     * number for the rest. `FilterSetting` gives each setting's range.
     */
    setFilter: <S extends FilterSetting>(filter: FilterId, setting: S, value: FilterSettingValue<S>, atMs?: number) => void;
    /** Sets one of the echo's settings to `value` at `atMs`. `EchoSetting` gives each setting's range. */
    setEcho: (setting: EchoSetting, value: number, atMs?: number) => void;
    /** Keeps voices 0 to `count` - 1 for music from `atMs`. Effects play only on the rest. */
    reserveVoices: (count: number, atMs?: number) => void;
    /** Releases every voice, music and effects, at `time`. */
    releaseAll: () => void;
}

/** A chip and its controls, as each chip's factory makes them. The chip is for the game's views, and the controls are for the game loop. */
export interface Audio80WithControls<A extends Audio80 = Audio80> {
    /** The chip, which the game's views play on. */
    readonly audio80: A;
    /** The chip's controls, which only the game loop uses. */
    readonly controls: AudioControls;
}
