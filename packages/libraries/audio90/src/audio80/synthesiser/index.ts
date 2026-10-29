export { AUDIO80_ECHO_DEFAULTS, createAudio80Synthesiser, type Audio80Synthesiser, type Audio80SynthesiserOptions } from './audio80-synthesiser';
export {
    AUDIO80_ECHO_SETTING_INDEX,
    AUDIO80_FILTER_SETTING_INDEX,
    OP80_SET_ECHO,
    OP80_SET_FILTER,
    AUDIO80_VOICE_COUNT,
    AUDIO80_VOICE_SETTING_INDEX,
} from './audio80-commands';
export type { Audio80EchoSetting, Audio80FilterSetting, Audio80VoiceSetting } from './audio80-commands';
export { AUDIO80_WAVETABLE_SIZE, toCutoff, toFilterModeFlags, toFilterRoute, toWaveFlags } from './audio80-sound-data';
export type { Audio80Character, Audio80FilterId, Audio80FilterMode, Audio80SoundData, Audio80StepData, Audio80Wave } from './audio80-sound-data';
