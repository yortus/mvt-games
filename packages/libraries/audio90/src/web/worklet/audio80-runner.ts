import { type Audio80Character, type Audio80PlayOptions, type Audio80Sound, createAudio80SongDriver, createAudio80SoundIds, createAudio80Synthesiser, type SoundData, VOICE_COUNT } from '../../audio80';
import { createCommandWriter, createSongPlayer } from '../../shared';
import { type ChipRunner, createChipRunner, type ScopeReply } from './chip-runner';
import type { SongPlaceReply } from './song-messages';
import { createWorkletSequencer } from './worklet-sequencer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The messages that define what an Audio80's commands use: its sounds. */
export interface Audio80PassedMessage {
    readonly kind: 'sound';
    readonly id: number;
    readonly data: SoundData;
}

/** The settings the main thread gives the Audio80's processor when it is made. */
export interface Audio80RunnerSettings {
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
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

/** Creates the runner of an Audio80's worklet, which renders its one channel. */
export function createAudio80Runner(options: Audio80RunnerOptions): ChipRunner<Audio80PassedMessage> {
    const { sampleRate } = options;
    const synthesiser = createAudio80Synthesiser({ sampleRate, character: options.character });
    return createChipRunner<Audio80PassedMessage>({
        sampleRate,
        channelCount: 1,
        voiceCount: VOICE_COUNT,
        currentFrame: options.currentFrame,
        sendScope: options.sendScope,
        sequencer: createWorkletSequencer({
            sampleRate,
            // Every sound a song plays was defined by the page, so the writer defines nothing of its own
            createWriter: (idOf) => createCommandWriter<Audio80Sound, Audio80PlayOptions>({ soundIds: createAudio80SoundIds({ idOf, onSound: ignore }) }),
            createPlayer: (writer) => createSongPlayer(createAudio80SongDriver(writer)),
            sendPlace: options.sendPlace,
        }),
        synthesiser: {
            enqueue: synthesiser.enqueue,
            get scope() {
                return synthesiser.scope;
            },
            set scope(scope) {
                synthesiser.scope = scope;
            },
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
