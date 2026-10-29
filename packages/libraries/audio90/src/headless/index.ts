// `audio90/headless`: everything that runs without a speaker. It holds
// each chip's headless version, which a game run headless plays on, and the
// tools that render sound in memory for tests: audio test hashes, peaks and
// loudness, WAV files, and finding the sounds a module exports.

export { createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
export { createHeadlessAudio90, type HeadlessAudio90 } from './headless-audio90';
export type { HeadlessChip } from './headless-chip';
export { findSounds, type ModuleSounds } from './find-sounds';
export {
    encodeWav,
    hashSamples,
    LOUDNESS_TOLERANCE_LU,
    measureLoudness,
    measurePeak,
    REFERENCE_LOUDNESS_LUFS,
    type RenderedSamples,
    type StereoSamples,
} from './rendered-samples';
export { type Audio80RenderOptions, type Audio90RenderOptions, render, type RenderOptions } from './rendering';
