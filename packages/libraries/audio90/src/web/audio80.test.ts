import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio80Sound, OP_PLAY, OP_PLAY_OPTIONS, OP_RELEASE_ALL, OP_SET_FILTER, OP_STOP } from '../audio80';
import { type ChipBatch, COMMAND_STRIDE } from '../shared';
import { createFakeAudioContext, type FakeAudioContext } from './fake-audio-context';
import { createAudio80 } from './audio80';

describe('createAudio80, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends the writes of one task together, in one batch, at the end of the task', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.stop(audio80.play(createAudio80Sound({ wave: 'saw' })));
        expect(fake.listBatches()).toHaveLength(0);
        await settle();
        expect(fake.listBatches()).toHaveLength(1);
        expect(listOps(fake.listBatches()[0])).toEqual([OP_PLAY_OPTIONS, OP_PLAY, OP_STOP]);
    });

    it('stamps a write made with no time to play as soon as it arrives', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        audio80.setFilter('a', 'cutoffHz', 800, 250);
        await settle();
        const [batch] = fake.listBatches();
        expect([batch.commands[COMMAND_STRIDE + 1], batch.commands[2 * COMMAND_STRIDE + 1]]).toEqual([-Infinity, 250]);
    });

    it('sends no batch while the audio context is suspended', async () => {
        const fake = createFakeContext('suspended');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        for (let i = 0; i < 10; i++) {
            audio80.play(createAudio80Sound({ wave: 'saw' }));
            await settle();
        }
        expect(fake.listBatches()).toHaveLength(0);
    });

    it('sends the settings made while suspended once the context runs, but not the plays', async () => {
        const fake = createFakeContext('suspended');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        // As when a song starts, write its filter and its first note
        audio80.setFilter('a', 'cutoffHz', 500);
        audio80.setFilter('a', 'cutoffHz', 800);
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        await settle();
        fake.setState('running');
        await settle();
        const [held, ...rest] = fake.listBatches();
        expect(listOps(held)).toEqual([OP_SET_FILTER]);
        expect(listValues(held, OP_SET_FILTER, 4)).toEqual([800]);
        expect(rest).toEqual([]);
    });

    it('sends the sounds first played while suspended, once each', async () => {
        const fake = createFakeContext('suspended');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const sound = createAudio80Sound({ wave: 'saw' });
        audio80.play(sound);
        await settle();
        fake.setState('running');
        audio80.play(sound);
        await settle();
        expect(fake.messages.filter((message) => message.kind === 'sound')).toHaveLength(1);
    });

    it('sends a stop made while suspended, so a sound played before still stops', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const id = audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        await settle();
        fake.setState('suspended');
        audio80.stop(id);
        await settle();
        fake.setState('running');
        await settle();
        const [, held] = fake.listBatches();
        expect(listOps(held)).toEqual([OP_STOP]);
        expect(listValues(held, OP_STOP, 2)).toEqual([id]);
    });

    it('tells the worklet as it pauses and resumes, and keeps only the lasting writes made while paused', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.pause();
        audio80.pause();
        expect(audio80.isPaused).toBe(true);
        expect(fake.messages).toEqual([{ kind: 'pause' }]);
        audio80.setFilter('a', 'cutoffHz', 800);
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        await settle();
        expect(fake.listBatches()).toHaveLength(0);
        audio80.resume();
        expect(audio80.isPaused).toBe(false);
        await settle();
        // The sound is defined as it is first played, paused or not
        expect(fake.messages.map((message) => message.kind)).toEqual(['pause', 'sound', 'resume', 'batch']);
        expect(listOps(fake.listBatches()[0])).toEqual([OP_SET_FILTER]);
    });

    it('sends a pause made before the worklet runs once it does, even after everything is stopped', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        audio80.pause();
        audio80.stop();
        await audio80.ready;
        expect(fake.messages).toEqual([{ kind: 'pause' }]);
    });

    it('releases every voice when everything is stopped while it plays', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        audio80.stop();
        await settle();
        expect(listOps(fake.listBatches()[0])).toEqual([OP_PLAY_OPTIONS, OP_PLAY, OP_RELEASE_ALL]);
        expect(fake.messages.some((message) => message.kind === 'reset')).toBe(false);
    });

    it('resets the worklet, cutting every voice, when everything is stopped while it is paused', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        await settle();
        audio80.pause();
        audio80.stop();
        expect(fake.messages.at(-1)).toEqual({ kind: 'reset' });
    });

    it('stops the worklet when destroyed, and sends nothing after', async () => {
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'stop' });
        const sent = fake.messages.length;
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        audio80.pause();
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
        const audio80 = createAudio80();
        expect([...listeners.keys()].sort()).toEqual(['keydown', 'pointerdown', 'touchend']);
        listeners.get('pointerdown')?.();
        expect(fake.context.state).toBe('running');
        // Once it runs, it no longer listens
        expect(listeners.size).toBe(0);
        audio80.destroy();
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
        const audio80 = createAudio80({ context: fake.context });
        await expect(audio80.ready).rejects.toThrow('no AudioWorklet here');
    });

    it('clamps its volume as every chip does', () => {
        const audio80 = createAudio80({ context: createFakeContext('running').context });
        audio80.volume = 3;
        const high = audio80.volume;
        audio80.volume = -1;
        expect([high, audio80.volume]).toEqual([1, 0]);
    });

    it('holds its sound while the page is hidden, apart from its own pause', async () => {
        const page = createFakePage();
        const fake = createFakeContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        page.setHidden(true);
        expect([audio80.isPaused, fake.messages.at(-1)]).toEqual([false, { kind: 'pause' }]);
        // A pause while hidden changes nothing the worklet hears, and holds the chip once the page shows
        audio80.pause();
        page.setHidden(false);
        expect(fake.messages.filter((message) => message.kind === 'pause' || message.kind === 'resume')).toEqual([{ kind: 'pause' }]);
        audio80.resume();
        expect(fake.messages.at(-1)).toEqual({ kind: 'resume' });
        audio80.destroy();
        expect(page.listenerCount()).toBe(0);
    });

    it('starts held in a hidden page, and plays on in one when made with pauseWhenHidden off', async () => {
        const page = createFakePage();
        page.setHidden(true);
        // One chip at a time, since each stand-in context puts its own worklet node in place
        const held = createFakeContext('running');
        await createAudio80({ context: held.context }).ready;
        const playing = createFakeContext('running');
        await createAudio80({ context: playing.context, pauseWhenHidden: false }).ready;
        expect(held.messages).toEqual([{ kind: 'pause' }]);
        expect(playing.messages).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Waits for the end of the task, when the chip sends what was written in it. */
async function settle(): Promise<void> {
    await Promise.resolve();
}

/** Puts a stand-in page in place of the browser's `document`, which says whether the page is hidden. */
function createFakePage() {
    const events = new EventTarget();
    let visibilityState: DocumentVisibilityState = 'visible';
    let listeners = 0;
    vi.stubGlobal('document', {
        get visibilityState() {
            return visibilityState;
        },
        addEventListener(name: string, listener: EventListener) {
            listeners++;
            events.addEventListener(name, listener);
        },
        removeEventListener(name: string, listener: EventListener) {
            listeners--;
            events.removeEventListener(name, listener);
        },
    });
    return {
        setHidden(isHidden: boolean) {
            visibilityState = isHidden ? 'hidden' : 'visible';
            events.dispatchEvent(new Event('visibilitychange'));
        },
        listenerCount: () => listeners,
    };
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
