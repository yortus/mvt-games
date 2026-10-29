import { type Audio80Character, type Audio80PlayOptions, type Audio80Sound, createAudio80SoundIds, createAudio80Synthesiser } from '../../audio80';
import { type CommandWriter, createCommandWriter } from '../../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80's synthesiser in memory, the writer that feeds it, and how to
 * render it and cut it. A rendering Audio80 is made of one, and so is
 * `render`.
 */
export interface Audio80Renderer {
    readonly writer: CommandWriter<Audio80Sound, Audio80PlayOptions>;
    /** Renders the next `output.length` samples into `output`, up to the writer's time, scaled by `gain`. */
    readonly render: (output: Float32Array, gain: number) => void;
    /** Cuts every voice at once, and forgets every sound. */
    readonly cut: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How an Audio80 renderer renders. */
export interface Audio80RendererOptions {
    /** The sample rate to render at, in Hz. */
    readonly sampleRate: number;
    /** How the chip sounds, or undefined for its default. */
    readonly character: Audio80Character | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an Audio80's synthesiser that renders at `sampleRate`, and the writer that feeds it, with nothing rendered yet. */
export function createAudio80Renderer(options: Audio80RendererOptions): Audio80Renderer {
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
