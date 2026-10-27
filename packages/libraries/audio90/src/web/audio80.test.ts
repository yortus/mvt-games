import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio80Instrument, OP_NOTE_OFF, OP_NOTE_ON, OP_RESERVE_VOICES, OP_SET_FILTER, OP_SET_MIX } from '../audio80';
import { type ChipBatch, COMMAND_STRIDE, MAX_MIX_VOLUME } from '../shared';
import { createFakeAudioContext, type FakeAudioContext } from './fake-audio-context';
import { createAudio80 } from './audio80';

/** The synthesiser's number for the music bus, in a mix command. */
const MUSIC_BUS = 0;

describe('createAudio80, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends the writes of one task together, in one batch, at the end of the task', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        audio80.noteOff(0);
        expect(fake.listBatches()).toHaveLength(0);
        await settle();
        expect(fake.listBatches()).toHaveLength(1);
        expect(listOps(fake.listBatches()[0])).toEqual([OP_NOTE_ON, OP_NOTE_OFF]);
    });

    it('stamps a write made with no time to play as soon as it arrives', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        audio80.noteOff(0, 250);
        await settle();
        const [batch] = fake.listBatches();
        expect([batch.commands[1], batch.commands[COMMAND_STRIDE + 1]]).toEqual([-Infinity, 250]);
    });

    it('sends no batch while the audio context is suspended', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        for (let i = 0; i < 10; i++) {
            audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
            await settle();
        }
        expect(fake.listBatches()).toHaveLength(0);
    });

    it('sends the settings made while suspended once the context runs, but not the notes', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        // As when a song starts, write the voices it keeps, its filter and its first note
        audio80.reserveVoices(4);
        audio80.setFilter('a', 'cutoffHz', 500);
        audio80.setFilter('a', 'cutoffHz', 800);
        audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        await settle();
        fake.setState('running');
        await settle();
        const [held, ...rest] = fake.listBatches();
        expect(listOps(held).sort()).toEqual([OP_SET_FILTER, OP_RESERVE_VOICES].sort());
        expect(listValues(held, OP_SET_FILTER, 4)).toEqual([800]);
        expect(rest).toEqual([]);
    });

    it('sends the instruments first played while suspended, once each', async () => {
        const fake = createFakeContext('suspended');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        const instrument = createAudio80Instrument({ wave: 'saw' });
        audio80.noteOn(0, instrument, 57, 1);
        await settle();
        fake.setState('running');
        audio80.noteOn(0, instrument, 57, 1);
        await settle();
        expect(fake.messages.filter((message) => message.kind === 'instrument')).toHaveLength(1);
    });

    it('sends a noteOff made while suspended, so a note started before still stops', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        audio80.noteOn(2, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        await settle();
        fake.setState('suspended');
        audio80.noteOff(2);
        await settle();
        fake.setState('running');
        await settle();
        const [, held] = fake.listBatches();
        expect(listOps(held)).toEqual([OP_NOTE_OFF]);
    });

    it('sends a mix change made while suspended once the context runs', async () => {
        const fake = createFakeContext('suspended');
        const { controls } = createAudio80({ context: fake.context });
        await controls.ready;
        controls.musicVolume = 0.25;
        await settle();
        fake.setState('running');
        await settle();
        expect(listValues(fake.listBatches()[0], OP_SET_MIX, 3, MUSIC_BUS)).toEqual([0.25]);
    });

    it('tells the worklet as it pauses and resumes, and keeps only the lasting writes made while paused', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        controls.pause();
        controls.pause();
        expect(controls.isPaused).toBe(true);
        expect(fake.messages).toEqual([{ kind: 'pause' }]);
        audio80.setFilter('a', 'cutoffHz', 800);
        audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        await settle();
        expect(fake.listBatches()).toHaveLength(0);
        controls.resume();
        expect(controls.isPaused).toBe(false);
        await settle();
        // The note's instrument is defined as it is first played, paused or not
        expect(fake.messages.map((message) => message.kind)).toEqual(['pause', 'instrument', 'resume', 'batch']);
        expect(listOps(fake.listBatches()[0])).toEqual([OP_SET_FILTER]);
    });

    it('sends a pause made before the worklet runs once it does, even after a reset', async () => {
        const fake = createFakeContext('running');
        const { controls } = createAudio80({ context: fake.context });
        controls.pause();
        controls.reset();
        await controls.ready;
        expect(fake.messages).toEqual([{ kind: 'pause' }]);
    });

    it('stops the worklet when destroyed, and sends nothing after', async () => {
        const fake = createFakeContext('running');
        const { audio80, controls } = createAudio80({ context: fake.context });
        await controls.ready;
        controls.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'stop' });
        const sent = fake.messages.length;
        audio80.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        controls.pause();
        await settle();
        expect(fake.messages).toHaveLength(sent);
    });

    it('makes its own audio context without one, starts it at the first gesture, and closes it when destroyed', async () => {
        const fake = createFakeContext('suspended');
        vi.stubGlobal('AudioContext', function AudioContext() {
            return fake.context;
        });
        const listeners = new Map<string, () => void>();
        vi.stubGlobal('addEventListener', (name: string, listener: () => void) => listeners.set(name, listener));
        vi.stubGlobal('removeEventListener', (name: string) => listeners.delete(name));
        const { controls } = createAudio80();
        expect([...listeners.keys()].sort()).toEqual(['keydown', 'pointerdown', 'touchend']);
        listeners.get('pointerdown')?.();
        expect(fake.context.state).toBe('running');
        // Once it runs, it no longer listens
        expect(listeners.size).toBe(0);
        controls.destroy();
        expect(fake.context.state).toBe('closed');
    });

    it('says what to use instead when there is no Web Audio, and no context is given', () => {
        expect(() => createAudio80()).toThrow(/audio90\/headless/);
    });

    it('leaves no unhandled rejection when the worklet cannot load and nobody awaits `ready`', async () => {
        const fake = createFakeContext('running', new Error('no AudioWorklet here'));
        createAudio80({ context: fake.context });
        // Long enough for an unhandled rejection to be reported, which fails the run
        await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('still rejects `ready` for whoever awaits it', async () => {
        const fake = createFakeContext('running', new Error('no AudioWorklet here'));
        const { controls } = createAudio80({ context: fake.context });
        await expect(controls.ready).rejects.toThrow('no AudioWorklet here');
    });

    it('clamps its volumes as every chip does', () => {
        const { controls } = createAudio80({ context: createFakeContext('running').context });
        controls.volume = 3;
        controls.musicVolume = -1;
        controls.effectsVolume = MAX_MIX_VOLUME + 1;
        expect([controls.volume, controls.musicVolume, controls.effectsVolume]).toEqual([1, 0, MAX_MIX_VOLUME]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Waits for the end of the task, when the chip sends what was written in it. */
async function settle(): Promise<void> {
    await Promise.resolve();
}

/** Creates a stand-in audio context, and puts its `AudioWorkletNode` in place of the browser's. */
function createFakeContext(state: AudioContextState, loadError?: Error): FakeAudioContext {
    const fake = createFakeAudioContext(state, loadError);
    vi.stubGlobal('AudioWorkletNode', fake.AudioWorkletNode);
    return fake;
}

function listOps(batch: ChipBatch): number[] {
    const ops: number[] = [];
    for (let i = 0; i < batch.count; i++) ops.push(batch.commands[i * COMMAND_STRIDE]);
    return ops;
}

/**
 * The values of the commands of `op` in `batch`. A value is the number at
 * `field`, which is 2 to 5 for `a` to `d`. If `a` is given, only commands
 * whose `a` matches it count.
 */
function listValues(batch: ChipBatch, op: number, field: number, a?: number): number[] {
    const values: number[] = [];
    for (let i = 0; i < batch.count; i++) {
        const at = i * COMMAND_STRIDE;
        if (batch.commands[at] !== op || (a !== undefined && batch.commands[at + 2] !== a)) continue;
        values.push(batch.commands[at + field]);
    }
    return values;
}
