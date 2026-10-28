export { createAudio80Synthesiser, type Audio80Synthesiser, type Audio80SynthesiserOptions } from './audio80-synthesiser';
export {
    ECHO_SETTING_INDEX,
    FILTER_SETTING_INDEX,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
} from './commands';
export type { Audio80EchoSetting, Audio80FilterSetting, Audio80VoiceSetting } from './commands';
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
