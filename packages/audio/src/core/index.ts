export { createAudio80Synthesiser, type Audio80Synthesiser, type Audio80SynthesiserOptions } from './audio80-synthesiser';
export {
    COMMAND_STRIDE,
    ECHO_SETTING_INDEX,
    ECHO_SETTINGS,
    FILTER_SETTING_INDEX,
    FILTER_SETTINGS,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY_EFFECT,
    OP_RELEASE_ALL,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    VOICE_SETTINGS,
} from './commands';
export type { ChipMessage, ChipReply, EchoSetting, FilterSetting, FilterSettingValue, MixBus, VoiceSetting, VoiceSettingValue } from './commands';
export {
    toCutoff,
    DEFAULT_STEP_MS,
    FILTER_BANDPASS,
    FILTER_HIGHPASS,
    FILTER_LOWPASS,
    FILTER_MODES,
    toFilterModeFlags,
    toFilterRoute,
    MAX_ARPEGGIO,
    WAVE_NOISE,
    WAVE_PULSE,
    WAVE_SAW,
    WAVE_TABLE,
    WAVE_TRIANGLE,
    WAVETABLE_SIZE,
    toWaveFlags,
} from './instrument-data';
export type { Character, EffectData, FilterId, FilterMode, InstrumentData, StepData, StepPitchMode, Wave } from './instrument-data';
export { toFrequency, HIGHEST_NOTE, HIGHEST_NOTE_NAME, LOWEST_NOTE, toNoteNumber } from './notes';
