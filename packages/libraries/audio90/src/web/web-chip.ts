import {
    type ChipBatch,
    type ChipBufferReply,
    type ChipClockReply,
    type ChipReply,
    clampVolume,
    createChipPlayback,
    joinMembers,
    MAX_MIX_VOLUME,
    type PlayingWriter,
    type SoundChip,
} from '../shared';
import type { PlayableSong } from '../song-player';
import { createHeldWrites, type HeldWriteSlots } from './held-writes';
import { createWebSongs } from './web-songs';
import type { PassedMessage, RunnerMessage, SongMessage, SongPlaceReply } from './worklet';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every chip in a browser has: an `AudioWorklet` node that plays the
 * chip's writes, the members that pause it and set its volumes, and its
 * songs, which play on the chip's sequencer in the worklet. Each chip's
 * factory makes its writer, then this, and adds its own members to `chip`.
 * `S` is the chip's song type, `Snd` its sound type and `O` its play options.
 *
 * The writer's commands are sent at the end of the task they were written
 * in, by a microtask, so the writes of one frame travel together. The chip's
 * time is the worklet's clock, which runs on the sound card's.
 */
export interface WebChip<D extends PassedMessage, S extends PlayableSong, Snd extends object, O> {
    /** The members every chip has, as `SoundChip` describes them. */
    readonly chip: SoundChip<S, Snd, O>;
    /** The chip time now, in ms: where the worklet's clock is, as its last reply said. 0 until the worklet first plays. */
    readonly time: number;
    /**
     * The chip time, in ms, of the sound reaching the speaker now. It trails
     * `time` by the sound card's latency. 0 until the worklet first plays.
     */
    readonly heardTime: number;
    /**
     * The audio context's frame reaching the speaker now, or undefined until
     * the worklet has replied and while the context is not running.
     */
    readonly speakerFrame: number | undefined;
    /**
     * Sends a message for the chip's own part of the worklet, such as one
     * that defines a sound. It is sent even while the audio context is
     * suspended, and kept until the worklet runs if it does not yet. The port
     * delivers messages in order, so it arrives before any command that uses
     * it. The buffers in `transfer` move with it, once the worklet runs.
     */
    send: (message: D, transfer?: Transferable[]) => void;
    /** Sends the writer's commands at the end of the current task. The writer calls it as a write lands in an empty batch. */
    sendSoon: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip's worklet node, and the members every chip has. */
export interface WebChipOptions<S extends PlayableSong, Snd extends object, O> {
    /**
     * The audio context to play in. Without one, the chip makes its own, and
     * starts it at the page's first click, tap or key press, since a browser
     * lets sound start only after the visitor does something. It closes it
     * as it is destroyed.
     */
    readonly context?: AudioContext;
    /** The chip's writer, whose commands the chip sends. It has no clock of its own: the worklet's is the chip's. */
    readonly writer: PlayingWriter<Snd, O>;
    /** The chip's held-write slots: which writes to keep while the chip cannot play. */
    readonly heldSlots: HeldWriteSlots;
    /** The worklet module's URL. */
    readonly processorUrl: string;
    /** The name the module registers its processor under. */
    readonly processorName: string;
    /** How many channels the node outputs: 1 for a mono chip, 2 for a stereo one. */
    readonly channelCount: number;
    /** The chip's settings for its processor. The listener's volumes, as they are when the node is made, are added to them. */
    readonly settings: object;
    /** Handles a reply from the worklet other than the chip's own, such as a scope. Defaults to dropping it. */
    readonly onReply?: (reply: { readonly kind: string }) => void;
    /**
     * Called as the chip resets its worklet, which it does as everything is
     * stopped while it is paused, for what the chip's own part must set up
     * again.
     */
    readonly onReset?: () => void;
    /**
     * Readies a song to send to the worklet, the first time it is played:
     * defines its instruments with the writer, and returns the ids they were
     * given, with the song as it travels.
     */
    readonly prepareSong: (song: S) => { readonly song: object; readonly soundIds: readonly number[] };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the members every browser chip has, and starts loading its
 * worklet. `ready` resolves once the worklet is running. Until then, while
 * the context is suspended, and while the chip is paused, the chip keeps the
 * writes whose effect lasts, and sends them once it can play.
 */
export function createWebChip<D extends PassedMessage, S extends PlayableSong, Snd extends object, O>(options: WebChipOptions<S, Snd, O>): WebChip<D, S, Snd, O> {
    const { writer } = options;
    const isOwnContext = options.context === undefined;
    const context = options.context ?? createOwnContext();

    const output = context.createGain();
    output.connect(context.destination);
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    let isPaused = false;
    let node: AudioWorkletNode | undefined;
    let isDestroyed = false;
    // Whether a send is due at the end of this task
    let isSendDue = false;

    // Messages sent before the worklet runs, sent once it does
    const waiting: (D | SongMessage | RunnerMessage)[] = [];
    // Batch buffers the worklet has sent back, to reuse
    const spares: Float64Array[] = [];
    // The writes kept while the chip cannot play, sent once it can
    const held = createHeldWrites(options.heldSlots);
    // Reused for every batch. This is safe because `postMessage` copies the
    // message, and moves the transferred buffer, before it returns
    const batch: BatchMessage = { kind: 'batch', commands: EMPTY, count: 0 };
    const transfer: Transferable[] = [EMPTY.buffer];
    // Where the worklet's clock was as it last replied, and how many frames the speaker trails the context's
    // count. They are in a typed array, because V8 boxes a double kept in a closure variable each time it is
    // written, and the speaker's lag is written with every reply
    const heard = new Float64Array(HEARD_FIELDS);
    let hasHeard = false;
    const songs = createWebSongs<S>({
        send: (message) => send(message),
        prepare: options.prepareSong,
        speakerFrame: () => (!hasHeard || context.state !== 'running' ? undefined : findSpeakerFrame()),
        sampleRate: () => context.sampleRate,
    });

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
        node.port.onmessage = (event: MessageEvent<ChipReply | SongPlaceReply | { readonly kind: string }>) => {
            const reply = event.data;
            if (reply.kind === 'song-place') {
                songs.receive(reply as SongPlaceReply);
            }
            else if (reply.kind === 'buffer') {
                if (spares.length < MAX_SPARES) spares.push((reply as ChipBufferReply).commands);
            }
            else if (reply.kind === 'clock') {
                const clock = reply as ChipClockReply;
                heard[PLAYHEAD_MS] = clock.playheadMs;
                heard[FRAME] = clock.frame;
                heard[MS_PER_SAMPLE] = clock.msPerSample;
                heard[SPEAKER_LAG_FRAMES] = measureSpeakerLag();
                hasHeard = true;
            }
            else {
                options.onReply?.(reply);
            }
        };
        node.connect(output);
        for (const message of waiting) node.port.postMessage(message);
        waiting.length = 0;
        // Writes kept while the worklet loaded can go now, if the chip can play
        if (held.count > 0) sendSoon();
    });
    // Mark the promise as handled, so a page that never awaits it gets no unhandled rejection. Code that
    // awaits it still sees the error
    ready.catch(ignore);
    // Writes kept while the context was suspended can go once it runs
    context.addEventListener('statechange', onStateChange);

    const chip = joinMembers(
        createChipPlayback<S, Snd, O>({
            songs,
            playSound: writer.play,
            stopSound: writer.stop,
            takePlayId: writer.takePlayId,
            stopVoices,
        }),
        {
            ready,
            get isPaused() {
                return isPaused;
            },
            get volume() {
                return volume;
            },
            set volume(value: number) {
                volume = clampVolume(value, 1);
                applyGain();
            },
            get isMuted() {
                return isMuted;
            },
            set isMuted(value: boolean) {
                isMuted = value;
                applyGain();
            },
            get musicVolume() {
                return musicVolume;
            },
            set musicVolume(value: number) {
                const clamped = clampVolume(value, MAX_MIX_VOLUME);
                if (clamped === musicVolume) return;
                musicVolume = clamped;
                if (node !== undefined) writer.setMix('music', clamped);
            },
            get effectsVolume() {
                return effectsVolume;
            },
            set effectsVolume(value: number) {
                const clamped = clampVolume(value, MAX_MIX_VOLUME);
                if (clamped === effectsVolume) return;
                effectsVolume = clamped;
                if (node !== undefined) writer.setMix('effects', clamped);
            },

            pause() {
                if (isPaused || isDestroyed) return;
                isPaused = true;
                send({ kind: 'pause' });
            },

            resume() {
                if (!isPaused || isDestroyed) return;
                isPaused = false;
                send({ kind: 'resume' });
                // Writes kept while it was paused can go now
                if (held.count > 0) sendSoon();
            },

            destroy() {
                if (isDestroyed) return;
                isDestroyed = true;
                context.removeEventListener('statechange', onStateChange);
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
                if (isOwnContext) {
                    stopListeningForGestures();
                    void context.close();
                }
            },
        },
    );

    return {
        chip,
        get time() {
            if (!hasHeard) return 0;
            return findChipTimeAt(context.currentTime * context.sampleRate);
        },
        get heardTime() {
            if (!hasHeard) return 0;
            return findChipTimeAt(findSpeakerFrame());
        },
        get speakerFrame() {
            return !hasHeard || context.state !== 'running' ? undefined : findSpeakerFrame();
        },
        send,
        sendSoon,
    };

    /**
     * Stops every voice's note, once the song has stopped. While the chip
     * plays, the notes are released, so each fades out as its envelope says.
     * While it is paused, nothing is heard, so the worklet is reset instead,
     * which cuts every voice, and forgets every sound and song sent. They are
     * sent again as they are next played.
     */
    function stopVoices(): void {
        if (!isPaused) {
            writer.releaseAll();
            return;
        }
        writer.clear(writer.commands);
        writer.forget();
        held.clear();
        waiting.length = 0;
        // A pause still waiting for the worklet was just cleared with the rest, so send it again
        if (node === undefined) waiting.push({ kind: 'pause' });
        // The worklet's sequencer forgets its songs as it resets, so the page does too
        songs.reset();
        if (node === undefined) return;
        node.port.postMessage({ kind: 'reset' } satisfies RunnerMessage);
        options.onReset?.();
        // The worklet keeps its mix through a reset. But a mix change not yet sent was just
        // cleared, so write the mix again
        writer.setMix('music', musicVolume);
        writer.setMix('effects', effectsVolume);
    }

    /** Sends a message to the worklet, or keeps it until the worklet runs. */
    function send(message: D | SongMessage | RunnerMessage, transfer?: Transferable[]): void {
        if (isDestroyed) return;
        // A message kept until the worklet runs is copied as it is sent then, rather than moved
        if (node === undefined) waiting.push(message);
        else if (transfer === undefined) node.port.postMessage(message);
        else node.port.postMessage(message, transfer);
    }

    /** Sends the writer's commands at the end of this task, once, however many are written. */
    function sendSoon(): void {
        if (isSendDue) return;
        isSendDue = true;
        queueMicrotask(sendWrites);
    }

    /** Sends the writes kept, then the writer's commands, or keeps those whose effect lasts if the chip can't play now. */
    function sendWrites(): void {
        isSendDue = false;
        if (node === undefined || context.state !== 'running' || isPaused) {
            // If sent now, these writes would wait in the worklet and play all at once when the chip can play.
            // Keep only the writes whose effect lasts, as `HeldWrites` explains, and drop the rest
            if (!isDestroyed) held.keep(writer.commands, writer.count);
            writer.clear(writer.commands);
            return;
        }
        if (held.count > 0) {
            // Send these ahead of the writer's, because they were written before them
            const count = held.count;
            const commands = held.take();
            node.port.postMessage({ kind: 'batch', commands, count } satisfies ChipBatch, [commands.buffer]);
        }
        if (writer.count === 0) return;
        const commands = writer.commands;
        batch.commands = commands;
        batch.count = writer.count;
        transfer[0] = commands.buffer;
        // The buffer is transferred, not copied, so `commands` is detached from here
        // on. The writer goes on in a buffer the worklet sent back, or in a new one
        node.port.postMessage(batch, transfer);
        writer.clear(spares.pop());
    }

    function onStateChange(): void {
        if (context.state === 'running') {
            if (held.count > 0) sendSoon();
            if (isOwnContext) stopListeningForGestures();
        }
    }

    /** The chip time at the audio context's frame `frame`, from the worklet's last clock reply. */
    function findChipTimeAt(frame: number): number {
        // Before the reply's frame, the clock was paused, or had yet to play, so it was where the reply says
        const since = frame - heard[FRAME];
        return since > 0 ? heard[PLAYHEAD_MS] + since * heard[MS_PER_SAMPLE] : heard[PLAYHEAD_MS];
    }

    /** The audio context's frame at the speaker now, as the last reply measured the speaker's lag. */
    function findSpeakerFrame(): number {
        return context.currentTime * context.sampleRate - heard[SPEAKER_LAG_FRAMES];
    }

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

    /** Makes the chip's own audio context, and starts it at the page's first gesture if it can't start yet. */
    function createOwnContext(): AudioContext {
        if (typeof AudioContext === 'undefined') {
            throw new Error('A browser chip needs Web Audio, and there is no AudioContext here. To play without a speaker, as in Node, use a headless chip from audio90/headless.');
        }
        const made = new AudioContext({ latencyHint: 'interactive' });
        if (made.state !== 'running') {
            for (const name of GESTURES) addEventListener(name, startOwnContext, GESTURE_LISTENER);
        }
        return made;
    }

    function startOwnContext(): void {
        void context.resume();
    }

    function stopListeningForGestures(): void {
        for (const name of GESTURES) removeEventListener(name, startOwnContext, GESTURE_LISTENER);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A batch message whose fields can be set, so one record serves every batch. */
interface BatchMessage {
    readonly kind: 'batch';
    commands: Float64Array;
    count: number;
}

const MAX_SPARES = 2;
/** Where each field is in `heard`. */
const PLAYHEAD_MS = 0;
const FRAME = 1;
const MS_PER_SAMPLE = 2;
const SPEAKER_LAG_FRAMES = 3;
const HEARD_FIELDS = 4;
/** What the reused batch message holds until the first batch. */
const EMPTY = new Float64Array(0);
/** The time constant of a volume or mute change, in seconds. The change settles in about 30 ms, which is slow enough not to click. */
const GAIN_SMOOTHING_S = 0.01;
/** The gestures that let a page start sound. A tap ends with `touchend`, which some phones need rather than `pointerdown`. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
/** Listened for before anything else on the page, so a handler that stops the event can't keep the sound off. */
const GESTURE_LISTENER: AddEventListenerOptions = { capture: true };

function ignore(): void {
    // Handled by whoever awaits `ready`
}
