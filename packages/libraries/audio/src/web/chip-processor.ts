import type { ChipReply } from '../core';
import { type ChipRunner, type ChipRunnerSettings, createChipRunner, PROCESSOR_NAME, type RunnerMessage } from './chip-runner';

// The worklet's entry point, which `createWebAudio80` loads on the audio
// thread. The worklet API takes a class, and gives it its port through
// `this`. So this file holds the only class in the repo. The class does
// nothing but pass the work to the closure-based runner.

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

class ChipProcessor extends AudioWorkletProcessor {
    private readonly runner: ChipRunner;

    constructor(options: { readonly processorOptions?: ChipRunnerSettings }) {
        super();
        const port = this.port;
        const runner = createChipRunner({
            ...options.processorOptions,
            sampleRate,
            sendBack: (reply: ChipReply) => port.postMessage(reply, [reply.commands.buffer]),
        });
        port.onmessage = (event: MessageEvent<RunnerMessage>) => runner.receive(event.data);
        this.runner = runner;
    }

    /** Renders one block. Returns false once the chip is destroyed, so that the browser stops calling it and can free the node. */
    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        this.runner.process(outputs[0][0]);
        return !this.runner.isStopped;
    }
}

registerProcessor(PROCESSOR_NAME, ChipProcessor);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// The audio thread's globals, which TypeScript's DOM library leaves out
declare const sampleRate: number;
declare class AudioWorkletProcessor {
    readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new (options: { readonly processorOptions?: ChipRunnerSettings }) => AudioWorkletProcessor): void;
