import { type Audio90Character, type Audio90PlayOptions, type Audio90Sound, createAudio90SoundIds, createAudio90Synthesiser } from '../audio90';
import { type CommandWriter, createCommandWriter } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** An Audio90's synthesiser in memory, the writer that feeds it, and how to render it and cut it, as for the Audio80. */
export interface Audio90Renderer {
    readonly writer: CommandWriter<Audio90Sound, Audio90PlayOptions>;
    /** Renders the next `left.length` samples into `left` and `right`, up to the writer's time, scaled by `gain`. */
    readonly render: (left: Float32Array, right: Float32Array, gain: number) => void;
    /** Cuts every voice at once, and forgets every sound. */
    readonly cut: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How an Audio90 renderer renders. */
export interface Audio90RendererOptions {
    /** The sample rate to render at, in Hz. */
    readonly sampleRate: number;
    /** How the chip sounds until a song sets it, or undefined for its default. */
    readonly character: Audio90Character | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an Audio90's synthesiser that renders at `sampleRate`, and the writer that feeds it, with nothing rendered yet. */
export function createAudio90Renderer(options: Audio90RendererOptions): Audio90Renderer {
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
