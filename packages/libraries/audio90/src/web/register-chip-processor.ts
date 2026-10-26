import type { ChipRunner, PassedMessage, RunnerMessage } from './chip-runner';

// What each chip's worklet module calls. The worklet API takes a class, and
// gives it its port through `this`. So this file holds the only class in the
// repo. The class does nothing but pass the work to the closure-based runner.

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the processor gives a chip's `createRunner`. */
export interface ProcessorContext<S> {
    /** The settings the main thread made the node with. */
    readonly settings: S | undefined;
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** The audio context's count of frames, at the start of the next block. */
    readonly currentFrame: () => number;
    /** Posts `reply` to the main thread, moving the buffers in `transfer` with it. */
    readonly post: (reply: object, transfer: Transferable[]) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Registers a chip's processor under `name`, on the audio thread. Each node
 * made with that name gets a runner from `createRunner`, and renders its
 * first output's channels with it.
 */
export function registerChipProcessor<S, D extends PassedMessage>(name: string, createRunner: (context: ProcessorContext<S>) => ChipRunner<D>): void {
    class ChipProcessor extends AudioWorkletProcessor {
        private readonly runner: ChipRunner<D>;

        constructor(options: { readonly processorOptions?: S }) {
            super();
            const port = this.port;
            const runner = createRunner({
                settings: options.processorOptions,
                sampleRate,
                currentFrame: () => currentFrame,
                post: (reply, transfer) => port.postMessage(reply, transfer),
            });
            port.onmessage = (event: MessageEvent<RunnerMessage<D>>) => runner.receive(event.data);
            this.runner = runner;
        }

        /** Renders one block. Returns false once the chip is destroyed, so that the browser stops calling it and can free the node. */
        process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
            this.runner.process(outputs[0]);
            return !this.runner.isStopped;
        }
    }

    registerProcessor(name, ChipProcessor);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// The audio thread's globals, which TypeScript's DOM library leaves out
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
    readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new (options: never) => AudioWorkletProcessor): void;
