import type { ChipBatch, ChipClockReply, ChipReply } from '../shared';
import { createChipClock } from './chip-clock';
import type { SongMessage } from './song-messages';
import type { WorkletSequencer } from './song-sequencer';

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
    /** Whether a `stop` message has arrived. From then on it renders silence, and the processor ends. */
    readonly isStopped: boolean;
    /** Handles one message from the main thread. */
    receive: (message: RunnerMessage<D>) => void;
    /** Renders one block into `channels`, filling each. A mono chip has one channel, and a stereo chip two. */
    process: (channels: readonly Float32Array[]) => void;
}

/**
 * What the main thread sends a chip's worklet: a batch of commands, `pause`
 * or `resume`, `reset`, `stop` when the chip is destroyed, a message for the
 * chip's sequencer, or a message the runner passes to the chip's own part,
 * such as one that defines a sound.
 */
export type RunnerMessage<D extends PassedMessage = PassedMessage> =
    | D
    | ChipBatch
    | SongMessage
    | { readonly kind: 'pause' }
    | { readonly kind: 'resume' }
    | { readonly kind: 'reset' }
    | { readonly kind: 'stop' };

/**
 * A message the runner passes to the chip's own part: one that defines
 * something the commands use, such as a sound or a sample, or one about the
 * scopes.
 */
export interface PassedMessage {
    readonly kind: 'sound' | 'sample' | 'scopes' | 'scope-buffer';
}

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
    /** The chip's synthesiser. */
    readonly synthesiser: RunnerSynthesiser<D>;
    /**
     * Sends the main thread a batch's buffer, so it can be written into
     * again, or where the clock is. It must copy the reply before it
     * returns, as `postMessage` does, since a clock reply's record is reused.
     */
    readonly sendBack: (reply: ChipReply) => void;
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
    const { sampleRate, channelCount, synthesiser, sendBack, sequencer } = options;
    const clock = createChipClock({ sampleRate });
    // Reused for every clock reply. Its fields are written, then it is copied as it is sent
    const clockReply: { -readonly [K in keyof ChipClockReply]: ChipClockReply[K] } = { kind: 'clock', playheadMs: 0, frame: 0, msPerSample: 0 };
    // The rate last sent, so a reply goes only as it changes. NaN until the first block, so the first block sends one
    let sentMsPerSample = Number.NaN;
    let isStopped = false;
    let renderedFrames = 0;
    const currentFrame = options.currentFrame ?? (() => renderedFrames);
    // Each channel's last sample of the last block. After a reset, `tails` holds those samples, and
    // each fades to 0 over the next block
    const lasts = new Float64Array(channelCount);
    const tails = new Float64Array(channelCount);

    return {
        get isStopped() {
            return isStopped;
        },

        receive(message) {
            switch (message.kind) {
                case 'batch':
                    synthesiser.enqueue(message.commands, message.count);
                    sendBack({ kind: 'buffer', commands: message.commands });
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
                case 'reset':
                    // Cutting the output from where it is to 0 would click
                    tails.set(lasts);
                    synthesiser.reset();
                    sequencer?.reset();
                    break;
                case 'stop':
                    isStopped = true;
                    break;
                default:
                    synthesiser.receive(message);
                    break;
            }
        },

        process(channels) {
            const frames = channels[0].length;
            if (isStopped) {
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

    function render(channels: readonly Float32Array[], frames: number): void {
        clock.plan(frames);
        if (clock.msPerSample !== sentMsPerSample) {
            // The clock has started, paused or resumed, so the main thread's idea of chip time needs its new rate
            sentMsPerSample = clock.msPerSample;
            clockReply.playheadMs = clock.fromMs;
            clockReply.frame = currentFrame();
            clockReply.msPerSample = clock.msPerSample;
            sendBack(clockReply);
        }
        if (clock.isSilent) {
            for (let c = 0; c < channelCount; c++) channels[c].fill(0);
            return;
        }
        // The songs move on by this block before it renders, so their writes fall within it
        sequencer?.advance(frames, clock.fromMs, clock.msPerSample, currentFrame(), synthesiser.enqueue);
        synthesiser.render(channels, frames, clock.fromMs, clock.msPerSample);
        const from = clock.gainFrom;
        const to = clock.gainTo;
        if (from === 1 && to === 1) return;
        for (let c = 0; c < channelCount; c++) {
            const output = channels[c];
            for (let i = 0; i < frames; i++) output[i] *= from + (to - from) * (i + 1) / frames;
        }
    }
}
