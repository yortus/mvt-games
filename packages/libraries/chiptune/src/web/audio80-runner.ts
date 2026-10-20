import { type Audio80Character, type Audio80ChipMessage, createAudio80Synthesiser } from '../audio80';
import { type ChipReply, MIX_BUS_INDEX } from '../shared';
import { type ChipRunner, createChipRunner } from './chip-runner';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The messages that define what an Audio80's commands use: its instruments and effects. */
export type Audio80PassedMessage = Extract<Audio80ChipMessage, { readonly kind: 'instrument' | 'effect' }>;

/** The settings the main thread gives the Audio80's processor when it is made. */
export interface Audio80RunnerSettings {
    /** The lead the clock keeps, in ms. Defaults to 100. */
    readonly leadMs?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
    /** The starting gain on the voices playing music, 0 to 2. Defaults to 1. */
    readonly musicVolume?: number;
    /** The starting gain on the voices playing effects, 0 to 2. Defaults to 1. */
    readonly effectsVolume?: number;
}

/** The name the Audio80's processor is registered under. */
export const AUDIO80_PROCESSOR_NAME = 'mvt-audio80';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio80's runner. It adds what only the audio thread knows to the processor's settings. */
export interface Audio80RunnerOptions extends Audio80RunnerSettings {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Sends a batch's buffer back to the main thread, so it can be written into again, with where the clock is. */
    readonly sendBack: (reply: ChipReply) => void;
    /** The audio context's count of frames, at the start of the next block. Defaults to counting the frames rendered. */
    readonly currentFrame?: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the runner of an Audio80's worklet, which renders its one channel. */
export function createAudio80Runner(options: Audio80RunnerOptions): ChipRunner<Audio80PassedMessage> {
    const { sampleRate } = options;
    const synthesiser = createAudio80Synthesiser({ sampleRate, character: options.character });
    synthesiser.setMix(MIX_BUS_INDEX.music, options.musicVolume ?? 1);
    synthesiser.setMix(MIX_BUS_INDEX.effects, options.effectsVolume ?? 1);
    return createChipRunner<Audio80PassedMessage>({
        sampleRate,
        channelCount: 1,
        leadMs: options.leadMs,
        sendBack: options.sendBack,
        currentFrame: options.currentFrame,
        synthesiser: {
            enqueue: synthesiser.enqueue,
            reset: synthesiser.reset,
            receive(message) {
                if (message.kind === 'instrument') synthesiser.defineInstrument(message.id, message.data);
                else synthesiser.defineEffect(message.id, message.data);
            },
            render(channels, frames, fromMs, msPerSample) {
                synthesiser.render(channels[0], 0, frames, fromMs, msPerSample);
            },
        },
    });
}
