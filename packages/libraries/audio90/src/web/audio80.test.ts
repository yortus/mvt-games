import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio80Song, createAudio80Sound, VOICE_COUNT } from '../audio80';
import { createScope, SCOPE_POINTS, toScopeLength } from '../shared';
import { createFakeAudioContext, type FakeAudioContext } from './fake-audio-context';
import { createAudio80 } from './audio80';

// What every browser chip does, tested on the Audio80. The Audio90's own tests
// cover what only it does.

describe('createAudio80, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends each play as it is made, after the sound it plays the first time, and each stop', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const sound = createAudio80Sound({ wave: 'saw' });
        const id = audio80.play(sound, { note: 'A-4', volume: 0.5 });
        audio80.stop(id);
        audio80.play(sound);
        expect(fake.messages.map((message) => message.kind)).toEqual(['sound', 'play', 'stop', 'play']);
        expect(fake.messages[1]).toMatchObject({ kind: 'play', soundId: 1, id, note: 69, volume: 0.5, hasPan: 0 });
        expect(fake.messages[2]).toEqual({ kind: 'stop', id });
    });

    it('checks a play\'s options as it is made', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        expect(() => audio80.play(createAudio80Sound({}), { lengthMs: 0 })).toThrow('play: lengthMs must be above 0');
        expect(() => audio80.play(createAudio80Sound({}), { note: 'H-4' })).toThrow('play: note:');
    });

    it('drops the plays made while suspended, and still sends the stops', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const held = audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        fake.setState('suspended');
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        audio80.stop(held);
        audio80.stop();
        // The sound is defined as it is first played, even when the play is dropped
        expect(fake.messages.map((message) => message.kind)).toEqual(['sound', 'play', 'sound', 'stop', 'song-call', 'release-all']);
    });

    it('sends the sounds first played while suspended, once each', async () => {
        const fake = installFakeAudioContext('suspended');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const sound = createAudio80Sound({ wave: 'saw' });
        audio80.play(sound);
        fake.setState('running');
        audio80.play(sound);
        expect(fake.listMessages('sound')).toHaveLength(1);
        expect(fake.listMessages('play')).toHaveLength(1);
    });

    it('tells the worklet as it pauses and resumes, drops the plays made while paused, and sends the stops', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const id = audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        audio80.pause();
        audio80.pause();
        expect(audio80.isPaused).toBe(true);
        audio80.stop(id);
        audio80.play(createAudio80Sound({ wave: 'triangle' }));
        audio80.resume();
        expect(audio80.isPaused).toBe(false);
        expect(fake.messages.map((message) => message.kind)).toEqual(['sound', 'play', 'pause', 'stop', 'sound', 'resume']);
    });

    it('drops what is played before the worklet runs, and sends a pause made then once it does', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        audio80.stop(audio80.play(createAudio80Sound({ wave: 'saw' })));
        audio80.pause();
        audio80.stop();
        await audio80.ready;
        expect(fake.messages).toEqual([{ kind: 'pause' }]);
    });

    it('releases every voice when everything is stopped while it plays', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        audio80.stop();
        expect(fake.messages.map((message) => message.kind)).toEqual(['sound', 'play', 'song-call', 'release-all']);
    });

    it('resets the worklet, cutting every voice, when everything is stopped while it is paused, and defines its sounds again after', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const sound = createAudio80Sound({ wave: 'saw' });
        audio80.play(sound, { lengthMs: Infinity });
        audio80.pause();
        audio80.stop();
        expect(fake.messages.at(-1)).toEqual({ kind: 'reset' });
        audio80.resume();
        audio80.play(sound);
        expect(fake.listMessages('sound')).toHaveLength(2);
    });

    it('sends a song once, after its instruments, then each call to its sequencer', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const song = createAudio80Song({ bpm: 120, instruments: { L: createAudio80Sound({ wave: 'pulse' }) }, patterns: { p: '| C-4 L' }, order: ['p'] });
        audio80.play(song);
        audio80.queue(song);
        expect(fake.messages.map((message) => message.kind)).toEqual(['sound', 'song', 'song-call', 'song-call']);
        expect(fake.listMessages('song')[0]).toMatchObject({ id: 1, soundIds: [1] });
        expect(fake.listMessages('song-call').map((message) => message.call)).toEqual(['play', 'queue']);
    });

    it('turns its scopes on as the first is attached, with three buffers to send them in, and copies each scope into every one', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const first = createScope(audio80);
        const second = createScope(audio80);
        expect(fake.messages.map((message) => message.kind)).toEqual(['scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
        expect([first.voiceCount, first.points.length, first.pans.length]).toEqual([VOICE_COUNT, VOICE_COUNT * SCOPE_POINTS, VOICE_COUNT]);
        fake.reply({ kind: 'scope', data: new Float32Array(toScopeLength(VOICE_COUNT)).fill(0.25) });
        expect([first.points[0], second.points[0], first.pans[0]]).toEqual([0.25, 0.25, 0.25]);
        // Its buffer goes back, to send the next scope in
        expect(fake.messages.at(-1)?.kind).toBe('scope-buffer');
    });

    it('turns its scopes off as the last is destroyed, clears it, and drops a scope that comes after', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        const first = createScope(audio80);
        const second = createScope(audio80);
        first.destroy();
        expect(fake.messages.at(-1)?.kind).toBe('scope-buffer');
        second.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'scopes', isOn: false });
        const sent = fake.messages.length;
        fake.reply({ kind: 'scope', data: new Float32Array(toScopeLength(VOICE_COUNT)).fill(0.5) });
        expect(second.points.every((value) => value === 0)).toBe(true);
        expect(fake.messages).toHaveLength(sent);
    });

    it('turns its scopes on again after the worklet resets, since the worklet turns its own off', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        createScope(audio80);
        audio80.pause();
        audio80.stop();
        const sinceReset = fake.messages.slice(fake.messages.findIndex((message) => message.kind === 'reset'));
        expect(sinceReset.map((message) => message.kind)).toEqual(['reset', 'scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
    });

    it('sends a destroy when destroyed, and nothing after', async () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        await audio80.ready;
        audio80.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'destroy' });
        const sent = fake.messages.length;
        audio80.play(createAudio80Sound({ wave: 'saw' }));
        audio80.pause();
        expect(fake.messages).toHaveLength(sent);
    });

    it('makes its own audio context without one, starts it at the first gesture, and closes it when destroyed', async () => {
        const fake = installFakeAudioContext('suspended');
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
        const fake = installFakeAudioContext('running', new Error('no AudioWorklet here'));
        createAudio80({ context: fake.context });
        // Long enough for an unhandled rejection to be reported, which fails the run
        await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('still rejects `ready` for whoever awaits it', async () => {
        const fake = installFakeAudioContext('running', new Error('no AudioWorklet here'));
        const audio80 = createAudio80({ context: fake.context });
        await expect(audio80.ready).rejects.toThrow('no AudioWorklet here');
    });

    it('sets its output to its volume, clamped as every chip does, and to 0 while muted', () => {
        const fake = installFakeAudioContext('running');
        const audio80 = createAudio80({ context: fake.context });
        audio80.volume = 0.5;
        audio80.isMuted = true;
        audio80.volume = 3;
        audio80.isMuted = false;
        audio80.volume = -1;
        expect(fake.gains).toEqual([0.5, 0, 0, 1, 0]);
        expect(audio80.volume).toBe(0);
    });

    it('holds its sound while the page is hidden, apart from its own pause', async () => {
        const page = installFakePage();
        const fake = installFakeAudioContext('running');
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
        const page = installFakePage();
        page.setHidden(true);
        // One chip at a time, since each stand-in context puts its own worklet node in place
        const held = installFakeAudioContext('running');
        await createAudio80({ context: held.context }).ready;
        const playing = installFakeAudioContext('running');
        await createAudio80({ context: playing.context, pauseWhenHidden: false }).ready;
        expect(held.messages).toEqual([{ kind: 'pause' }]);
        expect(playing.messages).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a stand-in audio context in `state`, and puts its `AudioWorkletNode` in place of the browser's. */
function installFakeAudioContext(state: AudioContextState, loadError?: Error): FakeAudioContext {
    const fake = createFakeAudioContext(state, loadError);
    vi.stubGlobal('AudioWorkletNode', fake.AudioWorkletNode);
    return fake;
}

/**
 * Puts a stand-in page in place of the browser's `document`, which says
 * whether the page is hidden. A test undoes it with `vi.unstubAllGlobals`.
 */
function installFakePage() {
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
