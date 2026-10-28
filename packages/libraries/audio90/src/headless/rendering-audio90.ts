import {
    type Audio90Character,
    type Audio90PlayOptions,
    type Audio90Sound,
    createAudio90SongDriver,
    createAudio90SoundIds,
    createAudio90Synthesiser,
} from '../audio90';
import { type CommandWriter, createCommandWriter, createSongPlayer, joinMembers } from '../shared';
import type { HeadlessAudio90 } from './headless-audio90';
import { createHeadlessChip, DEFAULT_SAMPLE_RATE } from './headless-chip';

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
export interface RenderingAudio90Options {
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
    const rendering = createAudio90Rendering({ sampleRate, character: options.character });
    const chip = createHeadlessChip({
        writer: rendering.writer,
        player: createSongPlayer(createAudio90SongDriver(rendering.writer)),
        cut: rendering.cut,
    });
    return joinMembers(chip, {
        sampleRate,
        renderInto(left: Float32Array, right: Float32Array) {
            rendering.render(left, right, chip.isMuted ? 0 : chip.volume);
        },
    });
}

/** An Audio90's synthesiser in memory, the writer that feeds it, and how to render it and cut it, as for the Audio80. */
export interface Audio90Rendering {
    readonly writer: CommandWriter<Audio90Sound, Audio90PlayOptions>;
    /** Renders the next `left.length` samples into `left` and `right`, up to the writer's time, scaled by `gain`. */
    readonly render: (left: Float32Array, right: Float32Array, gain: number) => void;
    /** Cuts every voice at once, and forgets every sound. */
    readonly cut: () => void;
}

/** Creates an Audio90's synthesiser that renders at `sampleRate`, and the writer that feeds it, with nothing rendered yet. */
export function createAudio90Rendering(options: { readonly sampleRate: number; readonly character: Audio90Character | undefined }): Audio90Rendering {
    const msPerSample = 1000 / options.sampleRate;
    const synthesiser = createAudio90Synthesiser({ sampleRate: options.sampleRate, character: options.character });
    const writer = createCommandWriter<Audio90Sound, Audio90PlayOptions>({
        soundIds: createAudio90SoundIds({
            onSound: (id, data) => synthesiser.defineSound(id, data),
            // A sample too big for what is left of sample memory is dropped, as the worklet drops it
            onSample: (id, data) => synthesiser.defineSample(id, data),
        }),
    });
    let renderedFrames = 0;
    return {
        writer,
        render(left, right, gain) {
            synthesiser.enqueue(writer.commands, writer.count);
            writer.clear();
            const frames = left.length;
            synthesiser.render(left, right, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) {
                    left[i] *= gain;
                    right[i] *= gain;
                }
            }
        },
        cut() {
            writer.clear();
            writer.forget();
            synthesiser.reset();
        },
    };
}
