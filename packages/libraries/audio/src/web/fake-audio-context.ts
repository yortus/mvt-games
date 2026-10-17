import type { ChipBatch } from '../shared';
import type { RunnerMessage } from './chip-runner';

// A stand-in for a browser's audio context, for the browser chips' tests in
// Node. It has just what a chip uses.

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
    /** Changes the context's state, as a browser does when audio starts or stops. */
    setState: (state: AudioContextState) => void;
    /** The batches among `messages`. */
    listBatches: () => ChipBatch[];
    /** Delivers `reply` to the node's port, as the worklet would send it. */
    reply: (reply: object) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a stand-in audio context in `state`. Its worklet fails to load with `loadError`, if given. */
export function createFakeAudioContext(state: AudioContextState, loadError?: Error): FakeAudioContext {
    let current = state;
    const messages: RunnerMessage[] = [];
    const nodeOptions: AudioWorkletNodeOptions[] = [];
    const processorNames: string[] = [];
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
        currentTime: 0,
        destination: audioNode,
        createGain: () => ({ ...audioNode, gain: { setTargetAtTime: ignore } }),
        audioWorklet: {
            addModule: () => (loadError === undefined ? Promise.resolve() : Promise.reject(loadError)),
        },
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
        setState(next) {
            current = next;
        },
        listBatches: () => messages.filter((message): message is ChipBatch => message.kind === 'batch'),
        reply(reply) {
            port.onmessage?.({ data: reply });
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function ignore(): void {
    // Nothing to do
}
