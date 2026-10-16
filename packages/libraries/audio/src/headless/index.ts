// `@mvtjs/audio/headless`: everything that runs without a speaker. It holds
// the headless chip, which a game run headless plays on, and the tools that
// render sound in memory for tests: audio test hashes, peaks and loudness, WAV
// files, and finding the sounds a module exports.

export {
    createHeadlessAudio80,
    type ChipLog,
    type ChipRenderer,
    type ChipWrite,
    type HeadlessAudio80,
    type HeadlessAudio80Options,
    type HeadlessRenderOptions,
} from './headless-audio80';
export { LOUDNESS_TOLERANCE_LU, measureLoudness, REFERENCE_LOUDNESS_LUFS } from './measure-loudness';
export { hashSamples, type ModuleSounds, measurePeak, renderSoundEffect, renderSong, type RenderOptions, findSounds } from './render';
export { encodeWav } from './encode-wav';
