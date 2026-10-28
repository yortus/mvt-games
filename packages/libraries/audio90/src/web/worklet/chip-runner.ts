import { ASAP_STAMP, type CheckedPlay, createCommandBuffer, OP_RELEASE_ALL, OP_STOP, toScopeLength, writePlay } from '../../shared';
import { createChipClock } from './chip-clock';
import type { SongMessage } from './song-messages';
import type { WorkletSequencer } from './worklet-sequencer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a chip's worklet runs. It holds the synthesiser and its clock, takes
 * the main thread's messages, and renders a block at a time. It does all of
 * the processor's work except the class that the worklet API requires, so
 * that the work can be tested in Node. It is the same for every chip: each
 * chip's runner gives it the chip's synthesiser.
 */
export interface ChipRunner<D extends PassedMessage = PassedMessage> {
    /** Whether a `destroy` message has arrived. From then on it renders silence, and the processor ends. */
    readonly isDestroyed: boolean;
    /** Handles one message from the main thread. */
    receive: (message: RunnerMessage<D>) => void;
    /** Renders one block into `channels`, filling each. A mono chip has one channel, and a stereo chip two. */
    process: (channels: readonly Float32Array[]) => void;
}

/**
 * What the main thread sends a chip's worklet: a play of a sound, a stop of
 * one play or of everything, `pause` or `resume`, `reset`, `destroy` when
 * the chip is destroyed, a message for the chip's sequencer, a message about
 * its scopes, or a message the runner passes to the chip's own part, such as
 * one that defines a sound. `scopes` turns the scopes on or off, and
 * `scope-buffer` hands the worklet an array to send a scope back in, so that
 * sending one allocates nothing.
 */
export type RunnerMessage<D extends PassedMessage = PassedMessage> =
    | D
    | PlayMessage
    | SongMessage
    | { readonly kind: 'stop'; readonly id: number }
    | { readonly kind: 'release-all' }
    | { readonly kind: 'pause' }
    | { readonly kind: 'resume' }
    | { readonly kind: 'reset' }
    | { readonly kind: 'destroy' }
    | { readonly kind: 'scopes'; readonly isOn: boolean }
    | { readonly kind: 'scope-buffer'; readonly data: Float32Array };

/** What a chip's worklet sends back beside its songs' places: a scope, in a buffer the page handed it. */
export interface ScopeReply {
    readonly kind: 'scope';
    readonly data: Float32Array;
}

/** A play of sound `soundId`, as play `id`, checked on the page. It plays as soon as it arrives. */
export interface PlayMessage extends CheckedPlay {
    readonly kind: 'play';
    readonly soundId: number;
    readonly id: number;
}

/** A message the runner passes to the chip's own part: one that defines something the commands use, such as a sound or a sample. */
export interface PassedMessage {
    readonly kind: 'sound' | 'sample';
}

/** How many blocks pass between scopes sent: one every fourth block, about 94 a second at 48 kHz. */
export const BLOCKS_PER_SCOPE = 4;

/** What the runner needs of a chip's synthesiser. Each chip's runner adapts its synthesiser to it. */
export interface RunnerSynthesiser<D extends PassedMessage> {
    /** Queues `count` commands from `commands`, which it copies. */
    enqueue: (commands: Float64Array, count: number) => void;
    /** Handles a message passed to the chip's own part, such as one that defines a sound. */
    receive: (message: D) => void;
    /** Renders `frames` samples into each of `channels`, the first at chip time `fromMs`, each `msPerSample` after the one before. */
    render: (channels: readonly Float32Array[], frames: number, fromMs: number, msPerSample: number) => void;
    /** Cuts every voice, and forgets what was defined. */
    reset: () => void;
    /** Where the synthesiser writes each voice's output for a scope as it renders, or undefined for none. */
    scope: Float32Array | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a runner. */
export interface ChipRunnerOptions<D extends PassedMessage> {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** How many channels the chip renders: 1 for mono, 2 for stereo. */
    readonly channelCount: number;
    /** How many voices the chip has, which its scopes show. */
    readonly voiceCount: number;
    /** Sends a scope to the main thread, in a buffer it handed over, which moves with the message. */
    readonly sendScope: (reply: ScopeReply) => void;
    /** The chip's synthesiser. */
    readonly synthesiser: RunnerSynthesiser<D>;
    /**
     * The audio context's count of frames, at the start of the next block.
     * The main thread knows when that frame reaches the speaker. Defaults to
     * counting the frames this runner has rendered.
     */
    readonly currentFrame?: () => number;
    /**
     * The chip's sequencer, which plays songs on the sound card's clock. It
     * moves on before each block the runner renders, and resets with the
     * chip. Without one, a song sent to the worklet is dropped.
     */
    readonly sequencer?: WorkletSequencer;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a runner with nothing queued, at chip time 0, playing. */
export function createChipRunner<D extends PassedMessage>(options: ChipRunnerOptions<D>): ChipRunner<D> {
    const { sampleRate, channelCount, synthesiser, sequencer, sendScope } = options;
    const scopeLength = toScopeLength(options.voiceCount);
    // The buffers the page has handed over to send scopes in, and the blocks since one was sent
    const scopeBuffers: Float32Array[] = [];
    const scopeCounter = new Int32Array(1);
    const clock = createChipClock({ sampleRate });
    // The commands a play or a stop makes, queued with the synthesiser as it arrives
    const commands = createCommandBuffer({ capacity: 2 });
    let isDestroyed = false;
    let renderedFrames = 0;
    const currentFrame = options.currentFrame ?? (() => renderedFrames);
    // Each channel's last sample of the last block. After a reset, `tails` holds those samples, and
    // each fades to 0 over the next block
    const lasts = new Float64Array(channelCount);
    const tails = new Float64Array(channelCount);

    return {
        get isDestroyed() {
            return isDestroyed;
        },

        receive(message) {
            switch (message.kind) {
                case 'play':
                    writePlay(commands.write, message.soundId, message.id, message);
                    enqueueCommands();
                    break;
                case 'stop':
                    commands.write(OP_STOP, ASAP_STAMP, message.id, 0, 0, 0);
                    enqueueCommands();
                    break;
                case 'release-all':
                    commands.write(OP_RELEASE_ALL, ASAP_STAMP, 0, 0, 0, 0);
                    enqueueCommands();
                    break;
                case 'pause':
                    clock.pause();
                    break;
                case 'resume':
                    clock.resume();
                    break;
                case 'song':
                case 'song-call':
                    sequencer?.receive(message);
                    break;
                case 'scopes':
                    if (!message.isOn) turnScopesOff();
                    else synthesiser.scope ??= new Float32Array(scopeLength);
                    break;
                case 'scope-buffer':
                    // A buffer that comes back after the scopes are turned off is dropped
                    if (synthesiser.scope !== undefined && scopeBuffers.length < MAX_SCOPE_BUFFERS) scopeBuffers.push(message.data);
                    break;
                case 'reset':
                    // Cutting the output from where it is to 0 would click
                    tails.set(lasts);
                    synthesiser.reset();
                    // The page turns them on again, if it still wants them
                    turnScopesOff();
                    sequencer?.reset();
                    break;
                case 'destroy':
                    isDestroyed = true;
                    break;
                default:
                    synthesiser.receive(message);
                    break;
            }
        },

        process(channels) {
            const frames = channels[0].length;
            if (isDestroyed) {
                for (let c = 0; c < channelCount; c++) channels[c].fill(0);
                renderedFrames += frames;
                return;
            }
            render(channels, frames);
            renderedFrames += frames;
            for (let c = 0; c < channelCount; c++) {
                const output = channels[c];
                const tail = tails[c];
                if (tail !== 0) {
                    for (let i = 0; i < frames; i++) output[i] += tail * (1 - (i + 1) / frames);
                    tails[c] = 0;
                }
                lasts[c] = output[frames - 1];
            }
        },
    };

    function turnScopesOff(): void {
        synthesiser.scope = undefined;
        scopeBuffers.length = 0;
    }

    /** Sends the scope every `BLOCKS_PER_SCOPE` blocks while scopes are on, if the page has handed over a buffer. */
    function sendScopeIfDue(): void {
        const scope = synthesiser.scope;
        if (scope === undefined) return;
        scopeCounter[0] = (scopeCounter[0] + 1) % BLOCKS_PER_SCOPE;
        if (scopeCounter[0] !== 0 || scopeBuffers.length === 0) return;
        const data = scopeBuffers.pop()!;
        data.set(scope);
        sendScope({ kind: 'scope', data });
    }

    function enqueueCommands(): void {
        synthesiser.enqueue(commands.commands, commands.count);
        commands.clear();
    }

    function render(channels: readonly Float32Array[], frames: number): void {
        clock.plan(frames);
        if (clock.isSilent) {
            for (let c = 0; c < channelCount; c++) channels[c].fill(0);
            return;
        }
        // The songs move on by this block before it renders, so their writes fall within it
        sequencer?.advance(frames, clock.fromMs, clock.msPerSample, currentFrame(), synthesiser.enqueue);
        synthesiser.render(channels, frames, clock.fromMs, clock.msPerSample);
        sendScopeIfDue();
        const from = clock.gainFrom;
        const to = clock.gainTo;
        if (from === 1 && to === 1) return;
        for (let c = 0; c < channelCount; c++) {
            const output = channels[c];
            for (let i = 0; i < frames; i++) output[i] *= from + (to - from) * (i + 1) / frames;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many buffers the page hands over for scopes, which is three: one always on its way back while another fills. */
const MAX_SCOPE_BUFFERS = 3;
