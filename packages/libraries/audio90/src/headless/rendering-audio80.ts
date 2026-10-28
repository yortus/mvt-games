import {
    type Audio80Character,
    type Audio80PlayOptions,
    type Audio80Sound,
    createAudio80SongDriver,
    createAudio80SoundIds,
    createAudio80Synthesiser,
} from '../audio80';
import { type CommandWriter, createCommandWriter, createSongPlayer, joinMembers } from '../shared';
import type { HeadlessAudio80 } from './headless-audio80';
import { createHeadlessChip, DEFAULT_SAMPLE_RATE } from './headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A headless Audio80 that plays everything in memory, for `render`, and for
 * the package's own tests and benchmarks. It is not exported. The code that
 * owns it moves its clock on with `update`, then renders the samples up to
 * that time with `renderInto`.
 */
export interface RenderingAudio80 extends HeadlessAudio80 {
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `output.length` samples into `output`, from where the
     * last render ended, and plays what was played since, each note exactly
     * at its time. The chip is mono, so there is one sample for each instant.
     * Each is -1 to 1, or beyond for a mix turned up past 1. Its volume and
     * mute apply. It allocates nothing, so a caller can render block after
     * block into the same buffer.
     */
    renderInto: (output: Float32Array) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How a rendering Audio80 renders. */
export interface RenderingAudio80Options {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a rendering Audio80, with its clock at 0, nothing played and nothing rendered. */
export function createRenderingAudio80(options: RenderingAudio80Options = {}): RenderingAudio80 {
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const rendering = createAudio80Rendering({ sampleRate, character: options.character });
    const chip = createHeadlessChip({
        writer: rendering.writer,
        player: createSongPlayer(createAudio80SongDriver(rendering.writer)),
        cut: rendering.cut,
    });
    return joinMembers(chip, {
        sampleRate,
        renderInto(output: Float32Array) {
            rendering.render(output, chip.isMuted ? 0 : chip.volume);
        },
    });
}

/**
 * An Audio80's synthesiser in memory, the writer that feeds it, and how to
 * render it and cut it. A rendering Audio80 is made of one, and so is
 * `render`.
 */
export interface Audio80Rendering {
    readonly writer: CommandWriter<Audio80Sound, Audio80PlayOptions>;
    /** Renders the next `output.length` samples into `output`, up to the writer's time, scaled by `gain`. */
    readonly render: (output: Float32Array, gain: number) => void;
    /** Cuts every voice at once, and forgets every sound. */
    readonly cut: () => void;
}

/** Creates an Audio80's synthesiser that renders at `sampleRate`, and the writer that feeds it, with nothing rendered yet. */
export function createAudio80Rendering(options: { readonly sampleRate: number; readonly character: Audio80Character | undefined }): Audio80Rendering {
    const msPerSample = 1000 / options.sampleRate;
    const synthesiser = createAudio80Synthesiser({ sampleRate: options.sampleRate, character: options.character });
    const writer = createCommandWriter<Audio80Sound, Audio80PlayOptions>({
        soundIds: createAudio80SoundIds({ onSound: (id, data) => synthesiser.defineSound(id, data) }),
    });
    let renderedFrames = 0;
    return {
        writer,
        render(output, gain) {
            synthesiser.enqueue(writer.commands, writer.count);
            writer.clear();
            const frames = output.length;
            synthesiser.render(output, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) output[i] *= gain;
            }
        },
        cut() {
            writer.clear();
            writer.forget();
            synthesiser.reset();
        },
    };
}
