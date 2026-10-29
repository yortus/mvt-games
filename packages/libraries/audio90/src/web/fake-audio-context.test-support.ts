import { vi } from 'vitest';
import type { RunnerMessage } from './worklet';

// A stand-in for a browser's audio context, for the browser chips' tests in
// Node. It has just what a chip uses. Like every `.test-support.ts` file, it
// is for tests only, and the published package leaves it out.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A stand-in audio context, and what a test reads back from it. */
export interface FakeAudioContext {
    /** The context, to give a chip. */
    readonly context: AudioContext;
    /**
     * The constructor to put in place of the global `AudioWorkletNode`, with
     * `vi.stubGlobal`. Its nodes' ports keep a copy of every message.
     */
    readonly AudioWorkletNode: unknown;
    /** Every message posted to a node, copied as the browser copies it, so transferred buffers are detached. */
    readonly messages: readonly RunnerMessage[];
    /** The options each node was made with. */
    readonly nodeOptions: readonly AudioWorkletNodeOptions[];
    /** The names each node's processor was made with. */
    readonly processorNames: readonly string[];
    /** Changes the context's state, and tells its `statechange` listeners, as a browser does when audio starts or stops. */
    setState: (state: AudioContextState) => void;
    /** Moves the context's `currentTime` to `seconds`, as the sound card plays. */
    setCurrentTime: (seconds: number) => void;
    /** The messages of one kind among `messages`, oldest first. */
    listMessages: <K extends RunnerMessage['kind']>(kind: K) => Extract<RunnerMessage, { readonly kind: K }>[];
    /** Each gain the chip has set its output to, oldest first. */
    readonly gains: readonly number[];
    /** Delivers `reply` to the node's port, as the worklet would send it. */
    reply: (reply: object) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a stand-in audio context in `state`, and puts its
 * `AudioWorkletNode` in place of the browser's. A test undoes it with
 * `vi.unstubAllGlobals`. Its worklet fails to load with `loadError`, if given.
 */
export function installFakeAudioContext(state: AudioContextState, loadError?: Error): FakeAudioContext {
    const fake = createFakeAudioContext(state, loadError);
    vi.stubGlobal('AudioWorkletNode', fake.AudioWorkletNode);
    return fake;
}

/** Creates a stand-in audio context in `state`. Its worklet fails to load with `loadError`, if given. */
function createFakeAudioContext(state: AudioContextState, loadError?: Error): FakeAudioContext {
    let current = state;
    let currentTime = 0;
    const messages: RunnerMessage[] = [];
    const nodeOptions: AudioWorkletNodeOptions[] = [];
    const processorNames: string[] = [];
    const gains: number[] = [];
    const stateListeners = new Set<() => void>();
    const audioNode = { connect: ignore, disconnect: ignore };
    const port = {
        onmessage: undefined as ((event: { data: object }) => void) | undefined,
        postMessage: (message: RunnerMessage, transfer?: Transferable[]) => {
            messages.push(structuredClone(message, { transfer }));
        },
        close: ignore,
    };
    const context = {
        get state() {
            return current;
        },
        get currentTime() {
            return currentTime;
        },
        sampleRate: FAKE_SAMPLE_RATE,
        baseLatency: FAKE_BASE_LATENCY_S,
        outputLatency: FAKE_OUTPUT_LATENCY_S,
        destination: audioNode,
        createGain: () => ({ ...audioNode, gain: { setTargetAtTime: (value: number) => gains.push(value) } }),
        audioWorklet: {
            addModule: () => (loadError === undefined ? Promise.resolve() : Promise.reject(loadError)),
        },
        resume: () => {
            setState('running');
            return Promise.resolve();
        },
        close: () => {
            setState('closed');
            return Promise.resolve();
        },
        addEventListener: (_name: 'statechange', listener: () => void) => stateListeners.add(listener),
        removeEventListener: (_name: 'statechange', listener: () => void) => stateListeners.delete(listener),
    };
    return {
        context: context as unknown as AudioContext,
        AudioWorkletNode: function AudioWorkletNode(_context: unknown, name: string, options: AudioWorkletNodeOptions) {
            processorNames.push(name);
            nodeOptions.push(options);
            return { ...audioNode, port };
        },
        messages,
        nodeOptions,
        processorNames,
        setState,
        setCurrentTime(seconds) {
            currentTime = seconds;
        },
        listMessages: <K extends RunnerMessage['kind']>(kind: K) => messages.filter((message): message is Extract<RunnerMessage, { readonly kind: K }> => message.kind === kind),
        gains,
        reply(reply) {
            port.onmessage?.({ data: reply });
        },
    };

    function setState(next: AudioContextState): void {
        current = next;
        for (const listener of stateListeners) listener();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The stand-in's sample rate, in Hz, and how long its sound takes to reach the speaker, in seconds. */
export const FAKE_SAMPLE_RATE = 48000;
export const FAKE_BASE_LATENCY_S = 0.01;
export const FAKE_OUTPUT_LATENCY_S = 0.03;

function ignore(): void {
    // Nothing to do
}
