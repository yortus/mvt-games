import { type Character, type ChipMessage, type ChipReply, createAudio80Synthesiser } from '../core';
import { createChipClock } from './chip-clock';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the worklet runs. It holds the synthesiser and its clock, takes the
 * main thread's messages, and renders a block at a time. It does all of the
 * processor's work except the class that the worklet API requires, so that
 * the work can be tested in Node.
 */
export interface ChipRunner {
    /** Whether a `stop` message has arrived. From then on it renders silence, and the processor ends. */
    readonly isStopped: boolean;
    /** Handles one message from the main thread. */
    receive: (message: RunnerMessage) => void;
    /** Renders one block of the chip's one channel into `output`, filling it. */
    process: (output: Float32Array) => void;
}

/** What the main thread sends the worklet: a chip message, or `stop` when the chip is destroyed. */
export type RunnerMessage = ChipMessage | { readonly kind: 'stop' };

/** The settings the main thread gives the processor when it is made. */
export interface ChipRunnerSettings {
    /** The lead the clock keeps, in ms. Defaults to 35. */
    readonly leadMs?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Character;
    /** The starting gain on the voices playing music, 0 to 2. Defaults to 1. */
    readonly musicVolume?: number;
    /** The starting gain on the voices playing effects, 0 to 2. Defaults to 1. */
    readonly effectsVolume?: number;
}

/** The name the processor is registered under. */
export const PROCESSOR_NAME = 'mvt-audio80';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a runner. It adds what only the audio thread knows to the processor's settings. */
export interface ChipRunnerOptions extends ChipRunnerSettings {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Sends a batch's buffer back to the main thread, so it can be written into again. */
    readonly sendBack: (reply: ChipReply) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a runner with nothing queued. It is silent until its clock has a full lead. */
export function createChipRunner(options: ChipRunnerOptions): ChipRunner {
    const { sampleRate, sendBack } = options;
    const synthesiser = createAudio80Synthesiser({ sampleRate, character: options.character });
    const clock = createChipClock({ sampleRate, leadMs: options.leadMs });
    synthesiser.setMix(MUSIC_BUS, options.musicVolume ?? 1);
    synthesiser.setMix(EFFECTS_BUS, options.effectsVolume ?? 1);
    let isStopped = false;
    // The last sample of the last block. After a reset, `tail` holds that sample and fades it to 0
    // over the next block
    let last = 0;
    let tail = 0;

    return {
        get isStopped() {
            return isStopped;
        },

        receive(message) {
            switch (message.kind) {
                case 'batch':
                    synthesiser.enqueue(message.commands, message.count);
                    clock.receive(message.horizonMs);
                    sendBack({ kind: 'buffer', commands: message.commands });
                    break;
                case 'instrument':
                    synthesiser.defineInstrument(message.id, message.data);
                    break;
                case 'effect':
                    synthesiser.defineEffect(message.id, message.data);
                    break;
                case 'reset':
                    // Cutting the output from where it is to 0 would click
                    tail = last;
                    synthesiser.reset();
                    clock.reset();
                    break;
                case 'stop':
                    isStopped = true;
                    break;
            }
        },

        process(output) {
            const frames = output.length;
            if (isStopped) {
                output.fill(0);
                return;
            }
            render(output, frames);
            if (tail !== 0) {
                for (let i = 0; i < frames; i++) output[i] += tail * (1 - (i + 1) / frames);
                tail = 0;
            }
            last = output[frames - 1];
        },
    };

    function render(output: Float32Array, frames: number): void {
        clock.plan(frames);
        if (clock.isSilent) {
            output.fill(0);
            return;
        }
        synthesiser.render(output, 0, frames, clock.fromMs, clock.msPerSample);
        const from = clock.gainFrom;
        const to = clock.gainTo;
        if (from === 1 && to === 1) return;
        for (let i = 0; i < frames; i++) output[i] *= from + (to - from) * (i + 1) / frames;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The synthesiser's mix buses, as `setMix` numbers them. */
const MUSIC_BUS = 0;
const EFFECTS_BUS = 1;
