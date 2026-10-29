import {
    type AnyPlayOptions,
    checkPlay,
    clampVolume,
    createChipPlayback,
    createScopeTargets,
    joinMembers,
    type PlayableSong,
    type PlayDefaults,
    registerScopeSource,
    type SongCallbacks,
    type SoundChip,
    type SoundIds,
    toScopeLength,
} from '../shared';
import { createWebSongs } from './web-songs';
import type { PassedMessage, RunnerMessage, ScopeReply, SongMessage, SongPlaceReply } from './worklet';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every chip in a browser has: an `AudioWorklet` node that plays the
 * chip's sounds and songs, the members that pause it and set its volume,
 * and the scopes `createScope` attaches to it. Each chip's factory makes its
 * sound ids, then this. `S` is the chip's song type, `Snd` its sound type
 * and `O` its play options.
 *
 * Each play, stop and song call goes to the worklet as a message of its own,
 * as it is made. The chip's clock is the worklet's, which runs on the sound
 * card's.
 */
export interface WebChip<D extends PassedMessage, S extends PlayableSong, Snd extends object, O> {
    /** The members every chip has, as `SoundChip` describes them. */
    readonly chip: SoundChip<S, Snd, O>;
    /**
     * Sends a message for the chip's own part of the worklet, such as one
     * that defines a sound. It is sent even while the audio context is
     * suspended, and kept until the worklet runs if it does not yet. The port
     * delivers messages in order, so it arrives before any play that uses
     * it. The buffers in `transfer` move with it, once the worklet runs.
     */
    send: (message: D, transfer?: Transferable[]) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip's worklet node, and the members every chip has. */
export interface WebChipOptions<S extends PlayableSong, Snd> {
    /**
     * The audio context to play in. Without one, the chip makes its own, and
     * starts it at the page's first click, tap or key press, since a browser
     * lets sound start only after the visitor does something. It closes it
     * as it is destroyed.
     */
    readonly context?: AudioContext;
    /** Whether the chip holds its sound while the page is hidden, as `pause` does. */
    readonly pauseWhenHidden: boolean;
    /** The chip's sound ids, which send each sound to the worklet the first time it is played. */
    readonly sounds: SoundIds<Snd>;
    /** The worklet module's URL. */
    readonly processorUrl: string;
    /** The name the module registers its processor under. */
    readonly processorName: string;
    /** How many channels the node outputs: 1 for a mono chip, 2 for a stereo one. */
    readonly channelCount: number;
    /** How many voices the chip has, which its scopes show. */
    readonly voiceCount: number;
    /** The chip's settings for its processor. */
    readonly settings: object;
    /**
     * Readies a song to send to the worklet, the first time it is played:
     * defines its instruments, and returns the ids they were given, with the
     * song as it travels.
     */
    readonly prepareSong: (song: S) => { readonly song: object; readonly soundIds: readonly number[] };
    /** What the chip calls as its songs reach each row, and end by themselves. */
    readonly callbacks?: SongCallbacks<S>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the members every browser chip has, and starts loading its
 * worklet. `ready` resolves once the worklet is running. Until then, while
 * the context is suspended, and while the chip is paused or the page hidden,
 * the chip drops the sounds played, since they would wait in the worklet and
 * play late. It still sends each stop, so a sound that started before still
 * stops.
 *
 * While a scope is attached, the worklet sends one about 94 times a second,
 * in one of three buffers that go back and forth, so none is allocated as
 * they do. Each is copied into every scope attached.
 */
export function createWebChip<D extends PassedMessage, S extends PlayableSong, Snd extends { readonly data: PlayDefaults }, O extends AnyPlayOptions>(
    options: WebChipOptions<S, Snd>,
): WebChip<D, S, Snd, O> {
    const { sounds } = options;
    const isOwnContext = options.context === undefined;
    const context = options.context ?? createOwnContext();

    const output = context.createGain();
    output.connect(context.destination);
    let volume = 1;
    let isMuted = false;
    // Paused by `pause`, and held while the page is hidden. The worklet holds the chip while either is true
    let isPaused = false;
    let isHidden = false;
    let node: AudioWorkletNode | undefined;
    let isDestroyed = false;
    let nextPlayId = 1;

    // The scopes attached, which the worklet's scopes are copied into
    const scopes = createScopeTargets();
    // Messages sent before the worklet runs, sent once it does
    const waiting: (D | SongMessage | RunnerMessage)[] = [];
    // How many frames the speaker trails the context's count, measured as each song place arrives. It is in a
    // typed array, because V8 boxes a double kept in a closure variable each time it is written
    const speakerLag = new Float64Array(1);
    let hasHeard = false;
    const songs = createWebSongs<S>({
        send: (message) => send(message),
        prepare: options.prepareSong,
        speakerFrame: () => (!hasHeard || context.state !== 'running' ? undefined : findSpeakerFrame()),
        sampleRate: () => context.sampleRate,
        onRow: options.callbacks?.onRow,
        onEnded: options.callbacks?.onEnded,
    });

    const ready = Promise.resolve().then(async () => {
        await context.audioWorklet.addModule(options.processorUrl);
        if (isDestroyed) return;
        node = new AudioWorkletNode(context, options.processorName, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            // A mono chip has one channel, which the browser plays on both speakers at full level on each
            outputChannelCount: [options.channelCount],
            processorOptions: options.settings,
        });
        // The node is set before it is set up. This is safe, because the setup runs in one go, so `send`
        // cannot run part way through it
        node.port.onmessage = (event: MessageEvent<SongPlaceReply | { readonly kind: string }>) => {
            const reply = event.data;
            if (reply.kind === 'song-place') {
                // Only the songs' places need to know when a frame is heard, so each one measures the speaker's lag
                speakerLag[0] = measureSpeakerLag();
                hasHeard = true;
                songs.receive(reply as SongPlaceReply);
            }
            else if (reply.kind === 'scope') {
                // A scope sent before the last was detached is dropped, and so is its buffer
                const { data } = reply as ScopeReply;
                if (!scopes.isAttached) return;
                scopes.fill(data);
                send({ kind: 'scope-buffer', data }, [data.buffer]);
            }
        };
        node.connect(output);
        for (const message of waiting) node.port.postMessage(message);
        waiting.length = 0;
    });
    // Mark the promise as handled, so a page that never awaits it gets no unhandled rejection. Code that
    // awaits it still sees the error
    ready.catch(ignore);
    if (isOwnContext) context.addEventListener('statechange', onStateChange);
    // A chip that pauses while the page is hidden starts held if it is made in a hidden page. With no page, as
    // in a worker, there is nothing to watch
    const isWatchingPage = options.pauseWhenHidden && typeof document !== 'undefined';
    if (isWatchingPage) {
        document.addEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange();
    }

    const chip = joinMembers(
        createChipPlayback<S, Snd, O>({
            songs,
            playSound,
            stopSound,
            takePlayId: () => nextPlayId++,
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
                volume = clampVolume(value);
                applyGain();
            },
            get isMuted() {
                return isMuted;
            },
            set isMuted(value: boolean) {
                isMuted = value;
                applyGain();
            },

            pause() {
                hold(true, isHidden);
            },

            resume() {
                hold(false, isHidden);
            },

            destroy() {
                if (isDestroyed) return;
                isDestroyed = true;
                if (isOwnContext) context.removeEventListener('statechange', onStateChange);
                if (isWatchingPage) document.removeEventListener('visibilitychange', onVisibilityChange);
                if (node !== undefined) {
                    node.port.postMessage({ kind: 'destroy' } satisfies RunnerMessage);
                    node.disconnect();
                    node.port.close();
                    node = undefined;
                }
                output.disconnect();
                waiting.length = 0;
                if (isOwnContext) {
                    stopListeningForGestures();
                    void context.close();
                }
            },
        },
    );

    registerScopeSource(chip, {
        voiceCount: options.voiceCount,
        attach(data) {
            if (scopes.attach(data)) sendScopesOn();
        },
        detach(data) {
            if (scopes.detach(data)) send({ kind: 'scopes', isOn: false });
        },
    });

    return { chip, send };

    /**
     * Plays `sound`, and returns the play's id. The sound is defined for the
     * worklet the first time, even if the play is dropped because the chip
     * can't play now.
     */
    function playSound(sound: Snd, playOptions: O | undefined): number {
        const play = checkPlay(sound.data, playOptions);
        const soundId = sounds.soundId(sound);
        const id = nextPlayId++;
        if (node !== undefined && context.state === 'running' && !isPaused && !isHidden) {
            node.port.postMessage({ kind: 'play', soundId, id, ...play } satisfies RunnerMessage);
        }
        return id;
    }

    /** Stops play `id`. Before the worklet runs, nothing has played, so there is nothing to stop. */
    function stopSound(id: number): void {
        node?.port.postMessage({ kind: 'stop', id } satisfies RunnerMessage);
    }

    /**
     * Stops every voice's note, once the song has stopped. While the chip
     * plays, the notes are released, so each fades out as its envelope says.
     * While it is paused, or held while the page is hidden, nothing is heard,
     * so the worklet is reset instead, which cuts every voice, and forgets
     * every sound and song sent. They are sent again as they are next played.
     */
    function stopVoices(): void {
        if (!isPaused && !isHidden) {
            node?.port.postMessage({ kind: 'release-all' } satisfies RunnerMessage);
            return;
        }
        sounds.forget();
        waiting.length = 0;
        // A pause still waiting for the worklet was just cleared with the rest, so send it again
        if (node === undefined) waiting.push({ kind: 'pause' });
        // The worklet's sequencer forgets its songs as it resets, so the page does too
        songs.reset();
        node?.port.postMessage({ kind: 'reset' } satisfies RunnerMessage);
        // The worklet turns its scopes off as it resets, and a message turning them on that was still waiting has
        // just been cleared, so they are turned on again
        if (scopes.isAttached) sendScopesOn();
    }

    /** Turns the worklet's scopes on, and hands it the buffers to send them in. */
    function sendScopesOn(): void {
        send({ kind: 'scopes', isOn: true });
        for (let i = 0; i < SCOPE_BUFFERS; i++) {
            const data = new Float32Array(toScopeLength(options.voiceCount));
            send({ kind: 'scope-buffer', data }, [data.buffer]);
        }
    }

    /**
     * Pauses the chip, or lets it play on, as `paused` (its own pause) and
     * `hidden` (the page's) say. The worklet holds the chip while either is
     * true, and hears only of a change between the two.
     */
    function hold(paused: boolean, hidden: boolean): void {
        if (isDestroyed) return;
        const wasHeld = isPaused || isHidden;
        isPaused = paused;
        isHidden = hidden;
        const isHeld = isPaused || isHidden;
        if (isHeld !== wasHeld) send({ kind: isHeld ? 'pause' : 'resume' });
    }

    function onVisibilityChange(): void {
        hold(isPaused, document.visibilityState === 'hidden');
    }

    /** Sends a message to the worklet, or keeps it until the worklet runs. */
    function send(message: D | SongMessage | RunnerMessage, transfer?: Transferable[]): void {
        if (isDestroyed) return;
        // A message kept until the worklet runs is copied as it is sent then, rather than moved
        if (node === undefined) waiting.push(message);
        else if (transfer === undefined) node.port.postMessage(message);
        else node.port.postMessage(message, transfer);
    }

    function onStateChange(): void {
        if (context.state === 'running') stopListeningForGestures();
    }

    /** The audio context's frame at the speaker now, as the last song place measured the speaker's lag. */
    function findSpeakerFrame(): number {
        return context.currentTime * context.sampleRate - speakerLag[0];
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

/** How many buffers go back and forth for scopes. With three, one is always on its way back while another fills. */
const SCOPE_BUFFERS = 3;
/** The time constant of a volume or mute change, in seconds. The change settles in about 30 ms, which is slow enough not to click. */
const GAIN_SMOOTHING_S = 0.01;
/** The gestures that let a page start sound. A tap ends with `touchend`, which some phones need rather than `pointerdown`. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
/** Listened for before anything else on the page, so a handler that stops the event can't keep the sound off. */
const GESTURE_LISTENER: AddEventListenerOptions = { capture: true };

function ignore(): void {
    // Handled by whoever awaits `ready`
}
