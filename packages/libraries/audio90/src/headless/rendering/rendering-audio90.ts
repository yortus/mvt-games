import { type Audio90Character, type Audio90Song, createAudio90SongDriver } from '../../audio90';
import { clampVolume, joinMembers, type SongCallbacks } from '../../shared';
import { createAudio90Renderer } from './audio90-renderer';
import type { HeadlessAudio90 } from '../headless-audio90';
import { createHeadlessChip, DEFAULT_SAMPLE_RATE } from '../headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A headless Audio90 that plays everything in memory, in stereo, as the rendering Audio80 does. It is not exported. */
export interface RenderingAudio90 extends HeadlessAudio90 {
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `left.length` samples into `left` and `right`, the two
     * channels, from where the last render ended, and plays what was played
     * since, each note exactly at its time. `right` must be at least as long
     * as `left`. Each sample is -1 to 1, or beyond for a mix turned up past 1.
     * Its volume and mute apply. It allocates nothing, so a caller can render
     * block after block into the same buffers.
     */
    renderInto: (left: Float32Array, right: Float32Array) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How a rendering Audio90 renders. */
export interface RenderingAudio90Options extends SongCallbacks<Audio90Song> {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a rendering Audio90, with its clock at 0, nothing played and nothing rendered. */
export function createRenderingAudio90(options: RenderingAudio90Options = {}): RenderingAudio90 {
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const renderer = createAudio90Renderer({ sampleRate, character: options.character });
    const chip = createHeadlessChip({
        writer: renderer.writer,
        driver: createAudio90SongDriver(renderer.writer),
        cut: renderer.cut,
        callbacks: options,
    });
    let stereoWidth = 1;
    return joinMembers(chip, {
        sampleRate,
        get stereoWidth() {
            return stereoWidth;
        },
        set stereoWidth(value: number) {
            // A width is clamped to 0 to 1, as a volume is
            stereoWidth = clampVolume(value);
            renderer.setStereoWidth(stereoWidth);
        },
        renderInto(left: Float32Array, right: Float32Array) {
            renderer.render(left, right, chip.isMuted ? 0 : chip.volume);
        },
    });
}
