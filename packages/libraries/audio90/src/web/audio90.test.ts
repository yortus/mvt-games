import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AUDIO90_EFFECT_INDEX,
    AUDIO90_SCOPE_LENGTH,
    type Audio90Sound,
    createAudio90Song,
    type Audio90SoundData,
    type Audio90Sample,
    type Audio90Song,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_SAMPLE,
    OP90_NOTE_ON,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../audio90';
import { type ChipBatch, COMMAND_STRIDE } from '../shared';
import { createFakeAudioContext, FAKE_BASE_LATENCY_S, FAKE_OUTPUT_LATENCY_S, FAKE_SAMPLE_RATE, type FakeAudioContext } from './fake-audio-context';
import { AUDIO90_PROCESSOR_NAME, type SongMessage, type SongPlaceReply } from './worklet';
import { createAudio90 } from './audio90';

describe('createAudio90, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('makes a node of its own processor, with two output channels', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context, character: 'console' });
        await audio90.ready;
        expect(fake.processorNames).toEqual([AUDIO90_PROCESSOR_NAME]);
        expect(fake.nodeOptions[0].outputChannelCount).toEqual([2]);
        expect(fake.nodeOptions[0].processorOptions).toEqual({ character: 'console' });
    });

    it('sends a sample once, before the first sound that plays it, and keeps its own copy', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const sample = createSample();
        audio90.play(createSound({ engine: ENGINE_SAMPLE }, sample));
        audio90.play(createSound({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample));
        await settle();
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'sound', 'sound', 'batch']);
        expect(sample.data.data.length).toBe(SAMPLE_LENGTH);
    });

    it('sends what was first played before the worklet ran, once it runs, in order', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        audio90.play(createSound({ engine: ENGINE_SAMPLE }, createSample()));
        await audio90.ready;
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'sound']);
    });

    it('sends the settings made while suspended once the context runs, but not the plays', async () => {
        const fake = createFakeContext('suspended');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        // As when a song starts: its effects, its character and its tempo, and a sound played
        audio90.setEffect('reverb', 'level', 0.3);
        audio90.setEffect('reverb', 'level', 0.5);
        audio90.setCharacter('sampler');
        audio90.setTempo(136);
        audio90.play(createSound());
        await settle();
        fake.setState('running');
        await settle();
        const [held, ...rest] = fake.listBatches();
        expect(listOps(held).sort()).toEqual([OP90_SET_EFFECT, OP90_SET_CHARACTER, OP90_SET_TEMPO].sort());
        expect(listOps(held)).not.toContain(OP90_NOTE_ON);
        expect(listValues(held, OP90_SET_EFFECT, 4, AUDIO90_EFFECT_INDEX.reverb)).toEqual([0.5]);
        expect(rest).toEqual([]);
    });

    it('turns scopes on with three buffers to send them in, and copies each scope in, sending its buffer back', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.setScopes(true);
        audio90.setScopes(true);
        expect(fake.messages.map((message) => message.kind)).toEqual(['scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
        const data = new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.25);
        fake.reply({ kind: 'scope', data });
        expect(audio90.scope[0]).toBe(0.25);
        expect(fake.messages.at(-1)?.kind).toBe('scope-buffer');
    });

    it('says its time is 0 until the worklet first says where its clock is', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        fake.setCurrentTime(1);
        expect([audio90.time, audio90.heardTime]).toEqual([0, 0]);
    });

    it('works out its time, and the time heard, from where the worklet\'s clock was at a frame, moved on by the frames since', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const msPerSample = 1000 / FAKE_SAMPLE_RATE;
        // The worklet's clock was at 400 ms as it rendered frame 24,000
        fake.reply({ kind: 'clock', playheadMs: 400, frame: 24000, msPerSample });
        // Half a second of frames later, the speaker plays a frame the latency behind
        fake.setCurrentTime(1);
        const speakerFrame = FAKE_SAMPLE_RATE * (1 - FAKE_BASE_LATENCY_S - FAKE_OUTPUT_LATENCY_S);
        expect(audio90.time).toBeCloseTo(900, 6);
        expect(audio90.heardTime).toBeCloseTo(400 + (speakerFrame - 24000) * msPerSample, 6);
    });

    it('holds its time while the worklet\'s clock is paused, and hears no further', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        fake.reply({ kind: 'clock', playheadMs: 250, frame: 12000, msPerSample: 0 });
        fake.setCurrentTime(10);
        expect([audio90.time, audio90.heardTime]).toEqual([250, 250]);
    });

    it('sends a song once, after its instruments and without their samples, then each call to its sequencer', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const song = createSequencedSong(createSound({ engine: ENGINE_SAMPLE }, createSample()));
        audio90.play(song);
        audio90.play(song);
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'sound', 'song', 'song-call', 'song-call']);
        const sent = fake.messages[2] as SongMessage;
        expect(sent.kind === 'song' && (sent.song as Audio90Song).instruments[0].sample).toBeUndefined();
        expect(fake.messages[3]).toEqual({ kind: 'song-call', call: 'play', songId: 1, generation: 1, value: 0 });
        expect(fake.messages[4]).toMatchObject({ generation: 2 });
        audio90.tempoScale = 0.5;
        expect(fake.messages.at(-1)).toMatchObject({ call: 'tempo', value: 0.5, generation: 2 });
        audio90.stop();
        expect(fake.messages.at(-1)).toMatchObject({ call: 'stop', generation: 3 });
        audio90.tempoScale = 0.5;
        expect(fake.messages.at(-1)).toMatchObject({ call: 'stop' });
    });

    it('says the song asked for is at its start until a place of it reaches the speaker, then which row is heard', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        expect(audio90.song).toBeUndefined();
        const song = createSequencedSong(createSound());
        audio90.play(song);
        expect([audio90.song, audio90.orderIndex, audio90.row]).toEqual([song, 0, 0]);
        // The speaker trails the context's count by its latency
        fake.reply({ kind: 'clock', playheadMs: 0, frame: 0, msPerSample: 1000 / FAKE_SAMPLE_RATE });
        const lagFrames = (FAKE_BASE_LATENCY_S + FAKE_OUTPUT_LATENCY_S) * FAKE_SAMPLE_RATE;
        for (let row = 0; row < 3; row++) fake.reply(createPlace({ frame: 4800 + row * 4800, row }));
        fake.setCurrentTime((4000 + lagFrames) / FAKE_SAMPLE_RATE);
        expect([audio90.song, audio90.row]).toEqual([song, 0]);
        fake.setCurrentTime((10000 + lagFrames) / FAKE_SAMPLE_RATE);
        expect([audio90.song, audio90.row]).toEqual([song, 1]);
        fake.setCurrentTime((14400 + lagFrames) / FAKE_SAMPLE_RATE);
        expect(audio90.row).toBe(2);
    });

    it('works out the beat heard from the place heard, moved on by the time since, at its tempo', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.play(createSequencedSong(createSound()));
        fake.reply({ kind: 'clock', playheadMs: 0, frame: 0, msPerSample: 1000 / FAKE_SAMPLE_RATE });
        fake.reply(createPlace({ frame: 0, beat: 2, tempoScale: 0.5 }));
        const lagFrames = (FAKE_BASE_LATENCY_S + FAKE_OUTPUT_LATENCY_S) * FAKE_SAMPLE_RATE;
        // Half a second after the place, at half the song's 120 BPM, is half a beat on
        fake.setCurrentTime((FAKE_SAMPLE_RATE / 2 + lagFrames) / FAKE_SAMPLE_RATE);
        expect(audio90.beat).toBeCloseTo(2.5, 6);
    });

    it('drops a place of the song before, still on its way, once another song plays', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const first = createSequencedSong(createSound());
        const second = createSequencedSong(createSound());
        audio90.play(first);
        fake.reply(createPlace({ generation: 1, row: 0 }));
        audio90.play(second);
        // Sent by the worklet before it heard of the second song
        fake.reply(createPlace({ generation: 1, orderIndex: 0, row: 1 }));
        expect([audio90.song, audio90.row]).toEqual([second, 0]);
        fake.reply(createPlace({ generation: 2, songId: 2, row: 0 }));
        expect(audio90.song).toBe(second);
    });

    it('reports the song gone once a place says it ended', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.play(createSequencedSong(createSound()));
        fake.reply(createPlace({ songId: 0 }));
        expect(audio90.song).toBeUndefined();
    });

    it('stops the song with its play\'s id, and leaves a song played since alone', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const first = audio90.play(createSequencedSong(createSound()));
        const second = audio90.play(createSequencedSong(createSound()));
        audio90.stop(first);
        expect(fake.messages.at(-1)).toMatchObject({ call: 'play' });
        audio90.stop(second);
        expect(fake.messages.at(-1)).toMatchObject({ call: 'stop' });
        expect(audio90.song).toBeUndefined();
    });

    it('forgets its songs as everything is stopped while paused, and sends a song again after', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const song = createSequencedSong(createSound());
        audio90.play(song);
        audio90.pause();
        audio90.stop();
        expect(audio90.song).toBeUndefined();
        audio90.resume();
        audio90.play(song);
        expect(fake.messages.filter((message) => message.kind === 'song')).toHaveLength(2);
    });

    it('turns its scopes on again after the worklet resets, since the worklet turns its own off', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.setScopes(true);
        audio90.pause();
        audio90.stop();
        const sinceReset = fake.messages.slice(fake.messages.findIndex((message) => message.kind === 'reset'));
        expect(sinceReset.map((message) => message.kind)).toEqual(['reset', 'scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
    });

    it('clears its scope when they are turned off, and drops a scope that comes after', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.setScopes(true);
        fake.reply({ kind: 'scope', data: new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.5) });
        audio90.setScopes(false);
        expect(audio90.scope.every((value) => value === 0)).toBe(true);
        const sent = fake.messages.length;
        fake.reply({ kind: 'scope', data: new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.5) });
        expect(audio90.scope[0]).toBe(0);
        expect(fake.messages).toHaveLength(sent);
    });

    it('sends a reset as everything is stopped while paused, and a stop when destroyed', async () => {
        const fake = createFakeContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.pause();
        audio90.stop();
        audio90.resume();
        expect(fake.messages.at(-2)).toEqual({ kind: 'reset' });
        audio90.destroy();
        expect(fake.messages.at(-1)).toEqual({ kind: 'stop' });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_LENGTH = 256;

/** A one-row song on `instrument`, for the sequencer. */
function createSequencedSong(instrument: Audio90Sound) {
    return createAudio90Song({ bpm: 120, instruments: { s: instrument }, patterns: { p: '| C-4 s' }, order: ['p'] });
}

/** A place of the first song, as the worklet sends it: playing, at the start, unless `place` says otherwise. */
function createPlace(place: Partial<SongPlaceReply>): SongPlaceReply {
    return { kind: 'song-place', generation: 1, frame: 0, songId: 1, orderIndex: 0, row: 0, beat: 0, tempoScale: 1, ...place };
}

/** Waits for the end of the task, when the chip sends what was written in it. */
async function settle(): Promise<void> {
    await Promise.resolve();
}

/** Creates a stand-in audio context, and puts its `AudioWorkletNode` in place of the browser's. */
function createFakeContext(state: AudioContextState): FakeAudioContext {
    const fake = createFakeAudioContext(state);
    vi.stubGlobal('AudioWorkletNode', fake.AudioWorkletNode);
    return fake;
}

/** A sound made by hand: its data, with the sample it plays, if any. */
function createSound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sample): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, ...data }, sample };
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
