import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MIX_VOLUME } from '../chip';
import { COMMAND_STRIDE, OP_NOTE_OFF, OP_NOTE_ON, OP_RESERVE_VOICES, OP_SET_FILTER, OP_SET_MIX } from '../core';
import { createInstrument } from '../notation';
import type { RunnerMessage } from './chip-runner';
import { createWebAudio80 } from './web-audio80';

const TICK_MS = 16;
/** The synthesiser's number for the music bus, in a mix command. */
const MUSIC_BUS = 0;

describe('createWebAudio80, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends each tick\'s writes while the audio context runs', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        audio80.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        tick(controls);
        expect(fake.listBatches()).toHaveLength(1);
        expect(listOps(fake.listBatches()[0])).toEqual([OP_NOTE_ON]);
    });

    it('sends no batch while the audio context is suspended', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        for (let i = 0; i < 10; i++) {
            audio80.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
            tick(controls);
        }
        expect(fake.listBatches()).toHaveLength(0);
    });

    it('sends the settings made while suspended once the context runs, but not the notes', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        // As when a song starts, write the voices it keeps, its filter and its first note
        audio80.reserveVoices(4);
        audio80.setFilter('a', 'cutoffHz', 500);
        audio80.setFilter('a', 'cutoffHz', 800);
        audio80.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        tick(controls);
        tick(controls);
        fake.setState('running');
        tick(controls);
        const [held, latest] = fake.listBatches();
        expect(listOps(held).sort()).toEqual([OP_SET_FILTER, OP_RESERVE_VOICES].sort());
        expect(listValues(held, OP_SET_FILTER, 4)).toEqual([800]);
        expect(listOps(latest)).toEqual([]);
    });

    it('sends the instruments first played while suspended, once each', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        const instrument = createInstrument({ wave: 'saw' });
        audio80.noteOn(0, instrument, 57, 1);
        tick(controls);
        fake.setState('running');
        audio80.noteOn(0, instrument, 57, 1);
        tick(controls);
        expect(fake.messages.filter((message) => message.kind === 'instrument')).toHaveLength(1);
    });

    it('sends a noteOff made while suspended, so a note started before still stops', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        audio80.noteOn(2, createInstrument({ wave: 'saw' }), 57, 1);
        tick(controls);
        fake.setState('suspended');
        audio80.noteOff(2);
        tick(controls);
        fake.setState('running');
        tick(controls);
        const [, held] = fake.listBatches();
        expect(listOps(held)).toEqual([OP_NOTE_OFF]);
    });

    it('sends a mix change made while suspended once the context runs', async () => {
        const fake = createFakeContext('suspended');
        const { controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        controls.musicVolume = 0.25;
        tick(controls);
        fake.setState('running');
        tick(controls);
        expect(listValues(fake.listBatches()[0], OP_SET_MIX, 3, MUSIC_BUS)).toEqual([0.25]);
    });

    it('stops the worklet when destroyed, and sends nothing after', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createWebAudio80({ context: fake.context });
        await controls.ready;
        controls.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'stop' });
        const sent = fake.messages.length;
        audio80.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        tick(controls);
        expect(fake.messages).toHaveLength(sent);
    });

    it('leaves no unhandled rejection when the worklet cannot load and nobody awaits `ready`', async () => {
        const fake = createFakeContext('running', new Error('no AudioWorklet here'));
        createWebAudio80({ context: fake.context });
        // Long enough for an unhandled rejection to be reported, which fails the run
        await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('still rejects `ready` for whoever awaits it', async () => {
        const fake = createFakeContext('running', new Error('no AudioWorklet here'));
        const { controls } = createWebAudio80({ context: fake.context });
        await expect(controls.ready).rejects.toThrow('no AudioWorklet here');
    });

    it('clamps its volumes as every chip does', () => {
        const { controls } = createWebAudio80({ context: createFakeContext('running').context });
        controls.volume = 3;
        controls.musicVolume = -1;
        controls.effectsVolume = MAX_MIX_VOLUME + 1;
        expect([controls.volume, controls.musicVolume, controls.effectsVolume]).toEqual([1, 0, MAX_MIX_VOLUME]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Controls {
    readonly update: (deltaMs: number) => void;
    readonly flush: () => void;
}

type Batch = Extract<RunnerMessage, { kind: 'batch' }>;

function tick(controls: Controls): void {
    controls.update(TICK_MS);
    controls.flush();
}

/**
 * Creates an audio context with just what the chip uses, and an
 * `AudioWorkletNode` whose port keeps a copy of every message. It copies each
 * message as the browser does, so transferred buffers are detached.
 */
function createFakeContext(initialState: AudioContextState, loadError?: Error) {
    let state = initialState;
    const messages: RunnerMessage[] = [];
    const audioNode = { connect: ignore, disconnect: ignore };
    const port = {
        onmessage: undefined as unknown,
        postMessage: (message: RunnerMessage, transfer?: Transferable[]) => {
            messages.push(structuredClone(message, { transfer }));
        },
        close: ignore,
    };
    vi.stubGlobal('AudioWorkletNode', function AudioWorkletNode() {
        return { ...audioNode, port };
    });
    const context = {
        get state() {
            return state;
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
        messages,
        setState: (next: AudioContextState) => {
            state = next;
        },
        listBatches: () => messages.filter((message): message is Batch => message.kind === 'batch'),
    };
}

function listOps(batch: Batch): number[] {
    const ops: number[] = [];
    for (let i = 0; i < batch.count; i++) ops.push(batch.commands[i * COMMAND_STRIDE]);
    return ops;
}

/**
 * The values of the commands of `op` in `batch`. A value is the number at
 * `field`, which is 2 to 5 for `a` to `d`. If `a` is given, only commands
 * whose `a` matches it count.
 */
function listValues(batch: Batch, op: number, field: number, a?: number): number[] {
    const values: number[] = [];
    for (let i = 0; i < batch.count; i++) {
        const at = i * COMMAND_STRIDE;
        if (batch.commands[at] !== op || (a !== undefined && batch.commands[at + 2] !== a)) continue;
        values.push(batch.commands[at + field]);
    }
    return values;
}

function ignore(): void {
    // Nothing to do
}
