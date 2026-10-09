import { type Audio80, type Audio80WithControls, type AudioControls, clampVolume, createCommandAudio80, MAX_MIX_VOLUME } from '../chip';
import type { Character, ChipMessage, ChipReply } from '../core';
import { type ChipRunnerSettings, PROCESSOR_NAME, type RunnerMessage } from './chip-runner';
import { createHeldWrites } from './held-writes';
import processorUrl from './chip-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio80. */
export interface WebAudio80Options {
    /**
     * The audio context to play in. The caller must resume it after a user
     * gesture, such as a click. Until it runs, the chip plays nothing, as
     * `AudioControls.ready` explains.
     */
    readonly context: AudioContext;
    /**
     * How far, in ms, the worklet plays behind the newest chip time it has
     * been sent. This leaves room for ticks that arrive late. Defaults to 35.
     */
    readonly leadMs?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 for a browser, and its controls. Once a tick,
 * `AudioControls.flush` sends the chip's writes to an `AudioWorklet`, which
 * plays them. The controls' `ready` resolves once the worklet is running.
 */
export function createWebAudio80(options: WebAudio80Options): Audio80WithControls {
    const { context } = options;

    const output = context.createGain();
    output.connect(context.destination);
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    let node: AudioWorkletNode | undefined;
    let isDestroyed = false;

    // Instruments and effects first played before the worklet runs, sent once it does
    const waiting: ChipMessage[] = [];
    // Batch buffers the worklet has sent back, to reuse
    const spares: Float64Array[] = [];
    // The writes kept while the chip cannot play, sent once it can
    const held = createHeldWrites();
    // Reused every tick. This is safe because `postMessage` copies the
    // message, and moves the transferred buffer, before it returns
    const batch: BatchMessage = { kind: 'batch', commands: EMPTY, count: 0, horizonMs: 0 };
    const transfer: Transferable[] = [EMPTY.buffer];

    const writer = createCommandAudio80({
        onInstrument: (id, data) => send({ kind: 'instrument', id, data }),
        onEffect: (id, data) => send({ kind: 'effect', id, data }),
    });

    const ready = Promise.resolve().then(async () => {
        await context.audioWorklet.addModule(processorUrl);
        if (isDestroyed) return;
        // Send the listener's mix as it is now. A change made before the worklet ran could not be sent as a command
        const settings: ChipRunnerSettings = { leadMs: options.leadMs, character: options.character, musicVolume, effectsVolume };
        node = new AudioWorkletNode(context, PROCESSOR_NAME, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            // The chip is mono. The browser plays one channel on both speakers, at full level on each
            outputChannelCount: [1],
            processorOptions: settings,
        });
        // The node is set before it is set up. This is safe, because the setup runs in one go, so `send`
        // cannot run part way through it
        node.port.onmessage = (event: MessageEvent<ChipReply>) => {
            if (spares.length < MAX_SPARES) spares.push(event.data.commands);
        };
        node.connect(output);
        for (const message of waiting) node.port.postMessage(message);
        waiting.length = 0;
    });
    // Mark the promise as handled, so a page that never awaits it gets no unhandled rejection. Code that
    // awaits it still sees the error
    ready.catch(ignore);

    const audio80: Audio80 = {
        get time() {
            return writer.time;
        },
        voiceCount: writer.voiceCount,
        play: writer.play,
        noteOn: writer.noteOn,
        noteOff: writer.noteOff,
        setVoice: writer.setVoice,
        setFilter: writer.setFilter,
        setEcho: writer.setEcho,
        reserveVoices: writer.reserveVoices,
        releaseAll: writer.releaseAll,
    };

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
                node.port.postMessage({ kind: 'batch', commands, count, horizonMs: writer.time } satisfies ChipMessage, [commands.buffer]);
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
            if (node === undefined) return;
            node.port.postMessage({ kind: 'reset' } satisfies ChipMessage);
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

    return { audio80, controls };

    function send(message: ChipMessage): void {
        if (isDestroyed) return;
        // Posted even while the audio context is suspended. The port delivers messages in order, so it
        // arrives before any command that uses it
        if (node === undefined) waiting.push(message);
        else node.port.postMessage(message);
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
/** What the reused batch message holds until the first tick. */
const EMPTY = new Float64Array(0);
/** The time constant of a volume or mute change, in seconds. The change settles in about 30 ms, which is slow enough not to click. */
const GAIN_SMOOTHING_S = 0.01;

function ignore(): void {
    // Handled by whoever awaits `ready`
}
