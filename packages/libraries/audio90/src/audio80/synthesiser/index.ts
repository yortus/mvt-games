export { createAudio80Synthesiser, type Audio80Synthesiser, type Audio80SynthesiserOptions } from './audio80-synthesiser';
export {
    ECHO_SETTING_INDEX,
    ECHO_SETTINGS,
    FILTER_SETTING_INDEX,
    FILTER_SETTINGS,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY,
    OP_PLAY_OPTIONS,
    OP_RELEASE_ALL,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    OP_STOP,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    VOICE_SETTINGS,
} from './commands';
export type { Audio80ChipMessage, Audio80EchoSetting, Audio80FilterSetting, Audio80FilterSettingValue, Audio80VoiceSetting, Audio80VoiceSettingValue } from './commands';
export {
    toCutoff,
    FILTER_BANDPASS,
    FILTER_HIGHPASS,
    FILTER_LOWPASS,
    FILTER_MODES,
    toFilterModeFlags,
    toFilterRoute,
    WAVE_NOISE,
    WAVE_PULSE,
    WAVE_SAW,
    WAVE_TABLE,
    WAVE_TRIANGLE,
    WAVETABLE_SIZE,
    toWaveFlags,
} from './sound-data';
export type { Audio80Character, Audio80FilterId, Audio80FilterMode, SoundData, StepData, Audio80Wave } from './sound-data';
