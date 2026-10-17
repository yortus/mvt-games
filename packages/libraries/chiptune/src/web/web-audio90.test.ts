import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AUDIO90_EFFECT_INDEX,
    AUDIO90_SCOPE_LENGTH,
    type Audio90Instrument,
    type Audio90InstrumentData,
    type Audio90Sample,
    DEFAULT_AUDIO90_INSTRUMENT,
    ENGINE_SAMPLE,
    OP90_NOTE_ON,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../audio90';
import { type ChipBatch, COMMAND_STRIDE } from '../shared';
import { AUDIO90_PROCESSOR_NAME } from './audio90-runner';
import { createFakeAudioContext, type FakeAudioContext } from './fake-audio-context';
import { createWebAudio90 } from './web-audio90';

const TICK_MS = 16;

describe('createWebAudio90, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('makes a node of its own processor, with two output channels', async () => {
        const fake = createFakeContext('running');
        const { controls } = createWebAudio90({ context: fake.context, character: 'console' });
        await controls.ready;
        expect(fake.processorNames).toEqual([AUDIO90_PROCESSOR_NAME]);
        expect(fake.nodeOptions[0].outputChannelCount).toEqual([2]);
        expect(fake.nodeOptions[0].processorOptions).toMatchObject({ character: 'console', musicVolume: 1, effectsVolume: 1 });
    });

    it('sends a sample once, before the first instrument that plays it, and keeps its own copy', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createWebAudio90({ context: fake.context });
        await controls.ready;
        const sample = createSample();
        audio90.noteOn(0, createInstrument({ engine: ENGINE_SAMPLE }, sample), 60, 1);
        audio90.noteOn(1, createInstrument({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample), 60, 1);
        tick(controls);
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'instrument', 'instrument', 'batch']);
        expect(sample.data.data.length).toBe(SAMPLE_LENGTH);
    });

    it('sends what was first played before the worklet ran, once it runs, in order', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createWebAudio90({ context: fake.context });
        audio90.noteOn(0, createInstrument({ engine: ENGINE_SAMPLE }, createSample()), 60, 1);
        await controls.ready;
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'instrument']);
    });

    it('sends the settings made while suspended once the context runs, but not the notes', async () => {
        const fake = createFakeContext('suspended');
        const { audio90, controls } = createWebAudio90({ context: fake.context });
        await controls.ready;
        // As when a song starts: its effects, its character, its tempo and its first note
        audio90.setEffect('reverb', 'level', 0.3);
        audio90.setEffect('reverb', 'level', 0.5);
        audio90.setCharacter('sampler');
        audio90.setTempo(136);
        audio90.noteOn(0, createInstrument(), 60, 1);
        tick(controls);
        fake.setState('running');
        tick(controls);
        const [held, latest] = fake.listBatches();
        expect(listOps(held).sort()).toEqual([OP90_SET_EFFECT, OP90_SET_CHARACTER, OP90_SET_TEMPO].sort());
        expect(listValues(held, OP90_SET_EFFECT, 4, AUDIO90_EFFECT_INDEX.reverb)).toEqual([0.5]);
        expect(listOps(latest)).not.toContain(OP90_NOTE_ON);
    });

    it('turns scopes on with three buffers to send them in, and copies each scope in, sending its buffer back', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createWebAudio90({ context: fake.context });
        await controls.ready;
        audio90.setScopes(true);
        audio90.setScopes(true);
        expect(fake.messages.map((message) => message.kind)).toEqual(['scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
        const data = new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.25);
        fake.reply({ kind: 'scope', data });
        expect(audio90.scope[0]).toBe(0.25);
        expect(fake.messages.at(-1)?.kind).toBe('scope-buffer');
    });

    it('clears its scope when they are turned off or the chip resets, and drops a scope that comes after', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createWebAudio90({ context: fake.context });
        await controls.ready;
        audio90.setScopes(true);
        fake.reply({ kind: 'scope', data: new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.5) });
        controls.reset();
        expect(audio90.scope.every((value) => value === 0)).toBe(true);
        const sent = fake.messages.length;
        fake.reply({ kind: 'scope', data: new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.5) });
        expect(audio90.scope[0]).toBe(0);
        expect(fake.messages).toHaveLength(sent);
        audio90.setScopes(true);
        audio90.setScopes(false);
        expect(fake.messages.at(-1)).toEqual({ kind: 'scopes', isOn: false });
    });

    it('sends a reset, then the mix again, and a stop when destroyed', async () => {
        const fake = createFakeContext('running');
        const { controls } = createWebAudio90({ context: fake.context });
        await controls.ready;
        controls.musicVolume = 0.5;
        controls.reset();
        expect(fake.messages.at(-1)).toEqual({ kind: 'reset' });
        tick(controls);
        expect(fake.listBatches().at(-1)?.count).toBe(2);
        controls.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'stop' });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_LENGTH = 256;

interface Controls {
    readonly update: (deltaMs: number) => void;
    readonly flush: () => void;
}

function tick(controls: Controls): void {
    controls.update(TICK_MS);
    controls.flush();
}

/** Creates a stand-in audio context, and puts its `AudioWorkletNode` in place of the browser's. */
function createFakeContext(state: AudioContextState): FakeAudioContext {
    const fake = createFakeAudioContext(state);
    vi.stubGlobal('AudioWorkletNode', fake.AudioWorkletNode);
    return fake;
}

/** An instrument made by hand: its data, with the sample it plays, if any. */
function createInstrument(data: Partial<Audio90InstrumentData> = {}, sample?: Audio90Sample): Audio90Instrument {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_INSTRUMENT, ...data }, sample };
}

/** A sample made by hand, of silence, with nothing to bounce. */
function createSample(): Audio90Sample {
    return { chip: 'audio90', slices: 1, length: SAMPLE_LENGTH, data: { data: new Int16Array(SAMPLE_LENGTH), sampleRate: 32000, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } };
}

function listOps(batch: ChipBatch): number[] {
    const ops: number[] = [];
    for (let i = 0; i < batch.count; i++) ops.push(batch.commands[i * COMMAND_STRIDE]);
    return ops;
}

/** The values at `field` (2 to 5 for `a` to `d`) of the commands of `op` in `batch` whose `a` is `a`. */
function listValues(batch: ChipBatch, op: number, field: number, a: number): number[] {
    const values: number[] = [];
    for (let i = 0; i < batch.count; i++) {
        const at = i * COMMAND_STRIDE;
        if (batch.commands[at] === op && batch.commands[at + 2] === a) values.push(batch.commands[at + field]);
    }
    return values;
}
