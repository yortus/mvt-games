export type {
    Character,
    EchoSetting,
    FilterId,
    FilterMode,
    FilterSetting,
    FilterSettingValue,
    VoiceSetting,
    VoiceSettingValue,
    Wave,
} from './core';
export {
    createInstrument,
    createSong,
    createSoundEffect,
    computeSongDurationMs,
    type EchoSettings,
    type Envelope,
    type FilterSettings,
    type FilterSweep,
    type Instrument,
    type InstrumentOptions,
    type PulseSweep,
    type Song,
    type SongOptions,
    type SoundEffect,
    type SoundEffectOptions,
    type Vibrato,
} from './notation';
export type { AudioControls } from './chip';
export type { Audio80, Audio80WithControls } from './chip';
export { createMusicPlayer, type MusicPlayer, type MusicPlayerOptions } from './music-player';
