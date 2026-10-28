// `audio90/headless`: everything that runs without a speaker. It holds
// each chip's headless version, which a game run headless plays on, and the
// tools that render sound in memory for tests: audio test hashes, peaks and
// loudness, WAV files, and finding the sounds a module exports.

export { createHeadlessAudio80, type Audio80Write, type HeadlessAudio80, type HeadlessAudio80Options, type HeadlessAudio80RenderOptions } from './headless-audio80';
export {
    createHeadlessAudio90,
    type Audio90Write,
    type HeadlessAudio90,
    type HeadlessAudio90Options,
    type HeadlessAudio90RenderOptions,
} from './headless-audio90';
export type { HeadlessChip } from './headless-chip';
export { LOUDNESS_TOLERANCE_LU, measureLoudness, REFERENCE_LOUDNESS_LUFS } from './measure-loudness';
export {
    type Audio80RenderOptions,
    type Audio90RenderOptions,
    findSounds,
    hashSamples,
    measurePeak,
    type ModuleSounds,
    render,
    type RenderOptions,
} from './render';
export type { RenderedSamples, StereoSamples } from './stereo-samples';
export { encodeWav } from './encode-wav';
