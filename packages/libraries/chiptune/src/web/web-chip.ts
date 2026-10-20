import { type AudioControls, type ChipBatch, type ChipReply, clampVolume, type CommandWriter, MAX_MIX_VOLUME } from '../shared';
import type { PassedMessage, RunnerMessage } from './chip-runner';
import { createHeldWrites, type HeldWriteSlots } from './held-writes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every chip in a browser has: an `AudioWorklet` node that plays the
 * chip's writes, and the controls that send them to it. Each chip's factory
 * makes its writer, then this, and joins the two.
 */
export interface WebChip<D extends PassedMessage> {
    /** The chip's controls. */
    readonly controls: AudioControls;
    /**
     * The chip time, in ms, of the sound reaching the speaker now. It trails
     * the writer's time by the worklet's lead and the sound card's latency.
     * Until the worklet runs, it is the writer's time.
     */
    readonly heardTime: number;
    /**
     * Sends a message for the chip's own part of the worklet, such as one
     * that defines an instrument. It is sent even while the audio context is
     * suspended, and kept until the worklet runs if it does not yet. The port
     * delivers messages in order, so it arrives before any command that uses
     * it. The buffers in `transfer` move with it, once the worklet runs.
     */
    send: (message: D, transfer?: Transferable[]) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip's worklet node and controls. */
export interface WebChipOptions {
    /** The audio context to play in. */
    readonly context: AudioContext;
    /** The chip's writer, whose commands the controls send each tick. */
    readonly writer: CommandWriter;
    /** The chip's held-write slots: which writes to keep while the chip cannot play. */
    readonly heldSlots: HeldWriteSlots;
    /** The worklet module's URL. */
    readonly processorUrl: string;
    /** The name the module registers its processor under. */
    readonly processorName: string;
    /** How many channels the node outputs: 1 for a mono chip, 2 for a stereo one. */
    readonly channelCount: number;
    /** The chip's settings for its processor. The controls add the listener's volumes as they are when the node is made. */
    readonly settings: object;
    /** Handles a reply from the worklet other than a batch's buffer, such as a scope. Defaults to dropping it. */
    readonly onReply?: (reply: { readonly kind: string }) => void;
    /** Called as the controls reset the chip, for what the chip's own part must reset too. */
    readonly onReset?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a chip's controls, and starts loading its worklet. The controls'
 * `ready` resolves once the worklet is running. Until then, and while the
 * context is suspended, the controls keep the writes whose effect lasts.
 */
export function createWebChip<D extends PassedMessage>(options: WebChipOptions): WebChip<D> {
    const { context, writer } = options;

    const output = context.createGain();
    output.connect(context.destination);
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    let node: AudioWorkletNode | undefined;
    let isDestroyed = false;

    // Messages sent before the worklet runs, sent once it does
    const waiting: D[] = [];
    // Batch buffers the worklet has sent back, to reuse
    const spares: Float64Array[] = [];
    // The writes kept while the chip cannot play, sent once it can
    const held = createHeldWrites(options.heldSlots);
    // Reused every tick. This is safe because `postMessage` copies the
    // message, and moves the transferred buffer, before it returns
    const batch: BatchMessage = { kind: 'batch', commands: EMPTY, count: 0, horizonMs: 0 };
    const transfer: Transferable[] = [EMPTY.buffer];
    // Where the worklet's clock was as it last replied, and how many frames the speaker trails the context's
    // count. They are in a typed array, because V8 boxes a double kept in a closure variable each time it is
    // written, and these are written every tick
    const heard = new Float64Array(HEARD_FIELDS);
    let hasHeard = false;
    let stallCount = 0;

    const ready = Promise.resolve().then(async () => {
        await context.audioWorklet.addModule(options.processorUrl);
        if (isDestroyed) return;
        // Send the listener's mix as it is now. A change made before the worklet ran could not be sent as a command
        node = new AudioWorkletNode(context, options.processorName, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            // A mono chip has one channel, which the browser plays on both speakers at full level on each
            outputChannelCount: [options.channelCount],
            processorOptions: { ...options.settings, musicVolume, effectsVolume },
        });
        // The node is set before it is set up. This is safe, because the setup runs in one go, so `send`
        // cannot run part way through it
        node.port.onmessage = (event: MessageEvent<ChipReply | { readonly kind: string }>) => {
            const reply = event.data;
            if (isBufferReply(reply)) {
                if (spares.length < MAX_SPARES) spares.push(reply.commands);
                heard[PLAYHEAD_MS] = reply.playheadMs;
                heard[FRAME] = reply.frame;
                heard[MS_PER_SAMPLE] = reply.msPerSample;
                heard[SPEAKER_LAG_FRAMES] = measureSpeakerLag();
                hasHeard = true;
                stallCount = reply.stallCount;
            }
            else {
                options.onReply?.(reply);
            }
        };
        node.connect(output);
        for (const message of waiting) node.port.postMessage(message);
        waiting.length = 0;
    });
    // Mark the promise as handled, so a page that never awaits it gets no unhandled rejection. Code that
    // awaits it still sees the error
    ready.catch(ignore);

    const controls: AudioControls = {
        ready,
        get volume() {
            return volume;
        },
        set volume(value) {
            volume = clampVolume(value, 1);
            applyGain();
        },
        get isMuted() {
            return isMuted;
        },
        set isMuted(value) {
            isMuted = value;
            applyGain();
        },
        get musicVolume() {
            return musicVolume;
        },
        set musicVolume(value) {
            const clamped = clampVolume(value, MAX_MIX_VOLUME);
            if (clamped === musicVolume) return;
            musicVolume = clamped;
            if (node !== undefined) writer.setMix('music', clamped);
        },
        get effectsVolume() {
            return effectsVolume;
        },
        set effectsVolume(value) {
            const clamped = clampVolume(value, MAX_MIX_VOLUME);
            if (clamped === effectsVolume) return;
            effectsVolume = clamped;
            if (node !== undefined) writer.setMix('effects', clamped);
        },
        get stallCount() {
            return stallCount;
        },
        update: writer.update,

        flush() {
            if (node === undefined || context.state !== 'running') {
                // If sent now, these writes would wait in the worklet and play all at once when the
                // context runs. Every tick would also need a new buffer. Keep only the writes whose
                // effect lasts, as `HeldWrites` explains, and drop the rest
                if (!isDestroyed) held.keep(writer.commands, writer.count);
                writer.clear(writer.commands);
                return;
            }
            if (held.count > 0) {
                // Send these ahead of this tick's batch, because they were written before it
                const count = held.count;
                const commands = held.take();
                node.port.postMessage({ kind: 'batch', commands, count, horizonMs: writer.time } satisfies ChipBatch, [commands.buffer]);
            }
            const commands = writer.commands;
            batch.commands = commands;
            batch.count = writer.count;
            batch.horizonMs = writer.time;
            transfer[0] = commands.buffer;
            // The buffer is transferred, not copied, so `commands` is detached from here
            // on. The writer goes on in a buffer the worklet sent back, or in a new one
            node.port.postMessage(batch, transfer);
            writer.clear(spares.pop());
        },

        reset() {
            writer.clear(writer.commands);
            writer.forget();
            held.clear();
            waiting.length = 0;
            hasHeard = false;
            options.onReset?.();
            if (node === undefined) return;
            node.port.postMessage({ kind: 'reset' } satisfies RunnerMessage);
            // The worklet keeps its mix through a reset. But a mix change not yet sent was just
            // cleared, so write the mix again
            writer.setMix('music', musicVolume);
            writer.setMix('effects', effectsVolume);
        },

        destroy() {
            if (isDestroyed) return;
            isDestroyed = true;
            if (node !== undefined) {
                node.port.postMessage({ kind: 'stop' } satisfies RunnerMessage);
                node.disconnect();
                node.port.close();
                node = undefined;
            }
            output.disconnect();
            writer.clear(writer.commands);
            held.clear();
            waiting.length = 0;
            spares.length = 0;
        },
    };

    return {
        controls,
        get heardTime() {
            if (!hasHeard || context.state !== 'running') return writer.time;
            // The frame at the speaker now, and the chip time the worklet's clock had reached there
            const speakerFrame = context.currentTime * context.sampleRate - heard[SPEAKER_LAG_FRAMES];
            const time = heard[PLAYHEAD_MS] + (speakerFrame - heard[FRAME]) * heard[MS_PER_SAMPLE];
            return time < writer.time ? time : writer.time;
        },
        send(message, transfer) {
            if (isDestroyed) return;
            // A message kept until the worklet runs is copied as it is sent then, rather than moved
            if (node === undefined) waiting.push(message);
            else if (transfer === undefined) node.port.postMessage(message);
            else node.port.postMessage(message, transfer);
        },
    };

    /** How many frames the speaker trails the context's count, as the audio context reports it. */
    function measureSpeakerLag(): number {
        // Where the browser cannot say when a frame reaches the speaker, it may still say how long it takes
        const atSpeaker = context.getOutputTimestamp?.().contextTime ?? 0;
        const lagSeconds = atSpeaker > 0 ? context.currentTime - atSpeaker : (context.baseLatency || 0) + (context.outputLatency || 0);
        return lagSeconds > 0 ? lagSeconds * context.sampleRate : 0;
    }

    function applyGain(): void {
        output.gain.setTargetAtTime(isMuted ? 0 : volume, context.currentTime, GAIN_SMOOTHING_S);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A batch message whose fields can be set, so one record serves every tick. */
interface BatchMessage {
    readonly kind: 'batch';
    commands: Float64Array;
    count: number;
    horizonMs: number;
}

const MAX_SPARES = 2;
/** Where each field is in `heard`. */
const PLAYHEAD_MS = 0;
const FRAME = 1;
const MS_PER_SAMPLE = 2;
const SPEAKER_LAG_FRAMES = 3;
const HEARD_FIELDS = 4;
/** What the reused batch message holds until the first tick. */
const EMPTY = new Float64Array(0);
/** The time constant of a volume or mute change, in seconds. The change settles in about 30 ms, which is slow enough not to click. */
const GAIN_SMOOTHING_S = 0.01;

function ignore(): void {
    // Handled by whoever awaits `ready`
}

function isBufferReply(reply: ChipReply | { readonly kind: string }): reply is ChipReply {
    return reply.kind === 'buffer';
}
