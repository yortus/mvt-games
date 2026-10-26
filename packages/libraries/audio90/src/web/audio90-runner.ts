import {
    type Audio90Character,
    type Audio90ChipMessage,
    AUDIO90_SCOPE_LENGTH,
    type Audio90Song,
    createAudio90Synthesiser,
    createCommandAudio90,
    OP90_NOTE_ON,
} from '../audio90';
import { createSongPlayer } from '../music-player';
import { type ChipReply, MIX_BUS_INDEX } from '../shared';
import { type ChipRunner, createChipRunner } from './chip-runner';
import type { SongPlaceReply } from './song-messages';
import { createWorkletSequencer } from './song-sequencer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The messages the Audio90's runner takes beside the batches and the songs:
 * those that define what its commands use (its instruments, effects and
 * samples), and those about its scopes. `scopes` turns them on or off.
 * `scope-buffer` hands the worklet an array of `AUDIO90_SCOPE_LENGTH`
 * numbers to send a scope back in, so that sending one allocates nothing.
 */
export type Audio90PassedMessage =
    | Extract<Audio90ChipMessage, { readonly kind: 'instrument' | 'effect' | 'sample' }>
    | { readonly kind: 'scopes'; readonly isOn: boolean }
    | { readonly kind: 'scope-buffer'; readonly data: Float32Array };

/** What the Audio90's worklet sends back beside a batch's buffer and its songs' places: a scope, in a buffer the page handed it. */
export interface Audio90ScopeReply {
    readonly kind: 'scope';
    readonly data: Float32Array;
}

/** The settings the main thread gives the Audio90's processor when it is made. */
export interface Audio90RunnerSettings {
    /** The lead the clock keeps, in ms. Defaults to 100. */
    readonly leadMs?: number;
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
    /** The starting gain on the voices playing music, 0 to 2. Defaults to 1. */
    readonly musicVolume?: number;
    /** The starting gain on the voices playing effects, 0 to 2. Defaults to 1. */
    readonly effectsVolume?: number;
}

/** The name the Audio90's processor is registered under. */
export const AUDIO90_PROCESSOR_NAME = 'audio90-chip';

/** How many blocks pass between scopes sent: one every fourth block, about 94 a second at 48 kHz. */
export const BLOCKS_PER_SCOPE = 4;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio90's runner. It adds what only the audio thread knows to the processor's settings. */
export interface Audio90RunnerOptions extends Audio90RunnerSettings {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Sends a batch's buffer back to the main thread, so it can be written into again, with where the clock is. */
    readonly sendBack: (reply: ChipReply) => void;
    /** The audio context's count of frames, at the start of the next block. Defaults to counting the frames rendered. */
    readonly currentFrame?: () => number;
    /** Sends a scope to the main thread, in a buffer it handed over, which moves with the message. */
    readonly sendScope: (reply: Audio90ScopeReply) => void;
    /** Sends where a slot of the sequencer is, each time it reaches a new row, or takes a call. It must copy the reply, as `postMessage` does. */
    readonly sendPlace: (reply: SongPlaceReply) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the runner of an Audio90's worklet, which renders its two
 * channels, left and right, and plays its songs on its own sequencer. While
 * scopes are on, it sends one every `BLOCKS_PER_SCOPE` blocks, when the page
 * has handed it a buffer to send it in. A reset turns them off.
 */
export function createAudio90Runner(options: Audio90RunnerOptions): ChipRunner<Audio90PassedMessage> {
    const { sampleRate, sendScope } = options;
    const synthesiser = createAudio90Synthesiser({ sampleRate, character: options.character });
    synthesiser.setMix(MIX_BUS_INDEX.music, options.musicVolume ?? 1);
    synthesiser.setMix(MIX_BUS_INDEX.effects, options.effectsVolume ?? 1);
    // The buffers the page has handed over to send scopes in, and the blocks since one was sent
    const spares: Float32Array[] = [];
    const counters = new Int32Array(1);
    const sequencer = createWorkletSequencer<Audio90Song, ReturnType<typeof createCommandAudio90>>({
        sampleRate,
        // Every instrument a song plays was defined by the page, and a song plays no effect, so the writer
        // defines nothing of its own
        createWriter: (idOf) => createCommandAudio90({ idOf, onInstrument: ignore, onEffect: ignore, onSample: ignore }),
        createPlayer: (writer) => createSongPlayer({ audio90: writer }),
        noteOnOp: OP90_NOTE_ON,
        sendPlace: options.sendPlace,
    });

    return createChipRunner<Audio90PassedMessage>({
        sampleRate,
        channelCount: 2,
        leadMs: options.leadMs,
        sendBack: options.sendBack,
        currentFrame: options.currentFrame,
        sequencer,
        synthesiser: {
            enqueue: synthesiser.enqueue,
            reset() {
                synthesiser.reset();
                turnScopesOff();
            },
            receive(message) {
                switch (message.kind) {
                    case 'instrument':
                        synthesiser.defineInstrument(message.id, message.data);
                        break;
                    case 'effect':
                        synthesiser.defineEffect(message.id, message.data);
                        break;
                    case 'sample':
                        // A sample too big for what is left of sample memory is dropped, and the notes that use it are silent
                        synthesiser.defineSample(message.id, message.data);
                        break;
                    case 'scopes':
                        if (!message.isOn) turnScopesOff();
                        else synthesiser.scope ??= new Float32Array(AUDIO90_SCOPE_LENGTH);
                        break;
                    case 'scope-buffer':
                        // A buffer that comes back after the scopes are turned off is dropped
                        if (synthesiser.scope !== undefined && spares.length < MAX_SPARES) spares.push(message.data);
                        break;
                }
            },
            render(channels, frames, fromMs, msPerSample) {
                synthesiser.render(channels[0], channels[1], 0, frames, fromMs, msPerSample);
                const scope = synthesiser.scope;
                if (scope === undefined) return;
                counters[0] = (counters[0] + 1) % BLOCKS_PER_SCOPE;
                if (counters[0] !== 0 || spares.length === 0) return;
                const data = spares.pop()!;
                data.set(scope);
                sendScope({ kind: 'scope', data });
            },
        },
    });

    function turnScopesOff(): void {
        synthesiser.scope = undefined;
        spares.length = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most buffers kept to send scopes in. The page hands over three. */
const MAX_SPARES = 3;

function ignore(): void {
    // The page defines every instrument a song plays
}
