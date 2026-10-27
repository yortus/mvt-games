import { type Audio80Character, type Audio80ChipMessage, type Audio80Song, createAudio80Synthesiser, createCommandAudio80 } from '../audio80';
import { createSongPlayer } from '../music-player';
import { type ChipReply, MIX_BUS_INDEX } from '../shared';
import { type ChipRunner, createChipRunner } from './chip-runner';
import type { SongPlaceReply } from './song-messages';
import { createWorkletSequencer } from './song-sequencer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The messages that define what an Audio80's commands use: its sounds. */
export type Audio80PassedMessage = Extract<Audio80ChipMessage, { readonly kind: 'sound' }>;

/** The settings the main thread gives the Audio80's processor when it is made. */
export interface Audio80RunnerSettings {
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
    /** The starting gain on the voices playing music, 0 to 2. Defaults to 1. */
    readonly musicVolume?: number;
    /** The starting gain on the voices playing sounds on their own, 0 to 2. Defaults to 1. */
    readonly effectsVolume?: number;
}

/** The name the Audio80's processor is registered under. */
export const AUDIO80_PROCESSOR_NAME = 'audio80-chip';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio80's runner. It adds what only the audio thread knows to the processor's settings. */
export interface Audio80RunnerOptions extends Audio80RunnerSettings {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Sends the main thread a batch's buffer, so it can be written into again, or where the clock is. It must copy the reply, as `postMessage` does. */
    readonly sendBack: (reply: ChipReply) => void;
    /** The audio context's count of frames, at the start of the next block. Defaults to counting the frames rendered. */
    readonly currentFrame?: () => number;
    /** Sends where a slot of the sequencer is, each time it reaches a new row, or takes a call. It must copy the reply, as `postMessage` does. */
    readonly sendPlace: (reply: SongPlaceReply) => void;
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
        sendBack: options.sendBack,
        currentFrame: options.currentFrame,
        sequencer: createWorkletSequencer<Audio80Song, ReturnType<typeof createCommandAudio80>>({
            sampleRate,
            // Every sound a song plays was defined by the page, so the writer defines nothing of its own
            createWriter: (idOf) => createCommandAudio80({ idOf, onSound: ignore }),
            createPlayer: (writer) => createSongPlayer({ audio80: writer }),
            sendPlace: options.sendPlace,
        }),
        synthesiser: {
            enqueue: synthesiser.enqueue,
            reset: synthesiser.reset,
            receive(message) {
                synthesiser.defineSound(message.id, message.data);
            },
            render(channels, frames, fromMs, msPerSample) {
                synthesiser.render(channels[0], 0, frames, fromMs, msPerSample);
            },
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function ignore(): void {
    // The page defines every sound a song plays
}
