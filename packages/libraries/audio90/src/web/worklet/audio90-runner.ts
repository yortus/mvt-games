import {
    type Audio90Character,
    AUDIO90_VOICE_COUNT,
    type Audio90PlayOptions,
    createAudio90SongDriver,
    createAudio90Synthesiser,
    createAudio90SoundIds,
    type Audio90SampleData,
    type Audio90Sound,
    type Audio90SoundData,
} from '../../audio90';
import { createCommandWriter, createSongPlayer } from '../../shared';
import { type ChipRunner, createChipRunner, type ScopeReply } from './chip-runner';
import type { SongPlaceReply } from './song-messages';
import { createWorkletSequencer } from './worklet-sequencer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The messages for the Audio90's own part: the sounds and samples its commands use, and its stereo width. */
export type Audio90PassedMessage =
    | { readonly kind: 'sound'; readonly id: number; readonly data: Audio90SoundData }
    | { readonly kind: 'sample'; readonly id: number; readonly data: Audio90SampleData }
    | { readonly kind: 'stereo-width'; readonly width: number };

/** The settings the main thread gives the Audio90's processor when it is made. */
export interface Audio90RunnerSettings {
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

/** The name the Audio90's processor is registered under. */
export const AUDIO90_PROCESSOR_NAME = 'audio90-chip';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio90's runner. It adds what only the audio thread knows to the processor's settings. */
export interface Audio90RunnerOptions extends Audio90RunnerSettings {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** The audio context's count of frames, at the start of the next block. Defaults to counting the frames rendered. */
    readonly currentFrame?: () => number;
    /** Sends a scope to the main thread, in a buffer it handed over, which moves with the message. */
    readonly sendScope: (reply: ScopeReply) => void;
    /** Sends where the song is, each time it reaches a new row, or takes a call. It must copy the reply, as `postMessage` does. */
    readonly sendPlace: (reply: SongPlaceReply) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the runner of an Audio90's worklet, which renders its two
 * channels, left and right, and plays its songs on its own sequencer.
 */
export function createAudio90Runner(options: Audio90RunnerOptions): ChipRunner<Audio90PassedMessage> {
    const { sampleRate } = options;
    const synthesiser = createAudio90Synthesiser({ sampleRate, character: options.character });
    const sequencer = createWorkletSequencer({
        sampleRate,
        // Every sound a song plays was defined by the page, so the writer defines nothing of its own
        createWriter: (idOf) => createCommandWriter<Audio90Sound, Audio90PlayOptions>({ soundIds: createAudio90SoundIds({ idOf, onSound: ignore, onSample: ignore }) }),
        createPlayer: (writer) => createSongPlayer({ driver: createAudio90SongDriver(writer) }),
        sendPlace: options.sendPlace,
    });

    return createChipRunner<Audio90PassedMessage>({
        sampleRate,
        channelCount: 2,
        voiceCount: AUDIO90_VOICE_COUNT,
        currentFrame: options.currentFrame,
        sendScope: options.sendScope,
        sequencer,
        synthesiser: {
            enqueue: synthesiser.enqueue,
            reset: synthesiser.reset,
            get scope() {
                return synthesiser.scope;
            },
            set scope(scope) {
                synthesiser.scope = scope;
            },
            receive(message) {
                switch (message.kind) {
                    case 'sound':
                        synthesiser.defineSound(message.id, message.data);
                        break;
                    case 'sample':
                        // A sample too big for what is left of sample memory is dropped, and the notes that use it are silent
                        synthesiser.defineSample(message.id, message.data);
                        break;
                    case 'stereo-width':
                        synthesiser.setStereoWidth(message.width);
                        break;
                }
            },
            render(channels, frames, fromMs, msPerSample) {
                synthesiser.render(channels[0], channels[1], 0, frames, fromMs, msPerSample);
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
