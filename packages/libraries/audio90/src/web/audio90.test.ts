import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AUDIO90_EFFECT_INDEX,
    AUDIO90_SCOPE_LENGTH,
    type Audio90Instrument,
    createAudio90Song,
    type Audio90InstrumentData,
    type Audio90Sample,
    type Audio90Song,
    DEFAULT_AUDIO90_INSTRUMENT,
    ENGINE_SAMPLE,
    OP90_NOTE_ON,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../audio90';
import { type ChipBatch, COMMAND_STRIDE } from '../shared';
import { AUDIO90_PROCESSOR_NAME } from './audio90-runner';
import { createFakeAudioContext, FAKE_BASE_LATENCY_S, FAKE_OUTPUT_LATENCY_S, FAKE_SAMPLE_RATE, type FakeAudioContext } from './fake-audio-context';
import type { SongMessage, SongPlaceReply } from './song-messages';
import { createAudio90 } from './audio90';

const TICK_MS = 16;

describe('createAudio90, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('makes a node of its own processor, with two output channels', async () => {
        const fake = createFakeContext('running');
        const { controls } = createAudio90({ context: fake.context, character: 'console' });
        await controls.ready;
        expect(fake.processorNames).toEqual([AUDIO90_PROCESSOR_NAME]);
        expect(fake.nodeOptions[0].outputChannelCount).toEqual([2]);
        expect(fake.nodeOptions[0].processorOptions).toMatchObject({ character: 'console', musicVolume: 1, effectsVolume: 1 });
    });

    it('sends a sample once, before the first instrument that plays it, and keeps its own copy', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
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
        const { audio90, controls } = createAudio90({ context: fake.context });
        audio90.noteOn(0, createInstrument({ engine: ENGINE_SAMPLE }, createSample()), 60, 1);
        await controls.ready;
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'instrument']);
    });

    it('sends the settings made while suspended once the context runs, but not the notes', async () => {
        const fake = createFakeContext('suspended');
        const { audio90, controls } = createAudio90({ context: fake.context });
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
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        audio90.setScopes(true);
        audio90.setScopes(true);
        expect(fake.messages.map((message) => message.kind)).toEqual(['scopes', 'scope-buffer', 'scope-buffer', 'scope-buffer']);
        const data = new Float32Array(AUDIO90_SCOPE_LENGTH).fill(0.25);
        fake.reply({ kind: 'scope', data });
        expect(audio90.scope[0]).toBe(0.25);
        expect(fake.messages.at(-1)?.kind).toBe('scope-buffer');
    });

    it('hears each write as it is made, until the worklet has said where its clock is', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        tick(controls);
        expect(audio90.heardTime).toBe(audio90.time);
    });

    it('hears the chip time the worklet\'s clock had reached at the frame now at the speaker, and counts its stalls', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        for (let i = 0; i < 80; i++) tick(controls);
        const msPerSample = 1000 / FAKE_SAMPLE_RATE;
        // The worklet was about to render frame 24,000, at chip time 400 ms, when the batch arrived
        fake.reply({ kind: 'buffer', commands: new Float64Array(COMMAND_STRIDE), playheadMs: 400, frame: 24000, msPerSample, stallCount: 2 });
        // Half a second of frames later, the speaker plays a frame the latency behind
        fake.setCurrentTime(1);
        const speakerFrame = FAKE_SAMPLE_RATE * (1 - FAKE_BASE_LATENCY_S - FAKE_OUTPUT_LATENCY_S);
        expect(audio90.heardTime).toBeCloseTo(400 + (speakerFrame - 24000) * msPerSample, 6);
        expect(audio90.heardTime).toBeLessThan(audio90.time);
        expect(controls.stallCount).toBe(2);
    });

    it('never hears past its own time', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        tick(controls);
        fake.reply({ kind: 'buffer', commands: new Float64Array(COMMAND_STRIDE), playheadMs: 0, frame: 0, msPerSample: 1000 / FAKE_SAMPLE_RATE, stallCount: 0 });
        fake.setCurrentTime(10);
        expect(audio90.heardTime).toBe(audio90.time);
    });

    it('sends a song once, after its instruments and without their samples, then each call to its slot', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        const song = createSequencedSong(createInstrument({ engine: ENGINE_SAMPLE }, createSample()));
        tick(controls);
        slot.play(song);
        slot.play(song);
        expect(fake.messages.map((message) => message.kind)).toEqual(['batch', 'sample', 'instrument', 'song', 'song-call', 'song-call']);
        const sent = fake.messages[3] as SongMessage;
        expect(sent.kind === 'song' && (sent.song as Audio90Song).instruments[0].sample).toBeUndefined();
        expect(fake.messages[4]).toMatchObject({ kind: 'song-call', slot: 1, call: 'play', songId: 1, generation: 1, stampMs: TICK_MS });
        expect(fake.messages[5]).toMatchObject({ generation: 2 });
        slot.setTempoScale(0.5);
        expect(fake.messages.at(-1)).toMatchObject({ call: 'tempo', value: 0.5, generation: 2 });
        slot.stop();
        expect(fake.messages.at(-1)).toMatchObject({ call: 'stop', generation: 3 });
    });

    it('says the song asked for is at its start until a place of it reaches the speaker, then which row is heard', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        expect(slot.song).toBeUndefined();
        const song = createSequencedSong(createInstrument());
        slot.play(song);
        expect([slot.song, slot.orderIndex, slot.row]).toEqual([song, 0, 0]);
        // The speaker trails the context's count by its latency
        fake.reply({ kind: 'buffer', commands: new Float64Array(COMMAND_STRIDE), playheadMs: 0, frame: 0, msPerSample: 1000 / FAKE_SAMPLE_RATE, stallCount: 0 });
        const lagFrames = (FAKE_BASE_LATENCY_S + FAKE_OUTPUT_LATENCY_S) * FAKE_SAMPLE_RATE;
        for (let row = 0; row < 3; row++) fake.reply(createPlace({ frame: 4800 + row * 4800, row }));
        fake.setCurrentTime((4000 + lagFrames) / FAKE_SAMPLE_RATE);
        expect([slot.song, slot.row]).toEqual([song, 0]);
        fake.setCurrentTime((10000 + lagFrames) / FAKE_SAMPLE_RATE);
        expect([slot.song, slot.row]).toEqual([song, 1]);
        fake.setCurrentTime((14400 + lagFrames) / FAKE_SAMPLE_RATE);
        expect(slot.row).toBe(2);
    });

    it('works out the beat heard from the place heard, moved on by the time since, at its tempo', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        slot.play(createSequencedSong(createInstrument()));
        fake.reply({ kind: 'buffer', commands: new Float64Array(COMMAND_STRIDE), playheadMs: 0, frame: 0, msPerSample: 1000 / FAKE_SAMPLE_RATE, stallCount: 0 });
        fake.reply(createPlace({ frame: 0, beat: 2, tempoScale: 0.5 }));
        const lagFrames = (FAKE_BASE_LATENCY_S + FAKE_OUTPUT_LATENCY_S) * FAKE_SAMPLE_RATE;
        // Half a second after the place, at half the song's 120 BPM, is half a beat on
        fake.setCurrentTime((FAKE_SAMPLE_RATE / 2 + lagFrames) / FAKE_SAMPLE_RATE);
        expect(slot.beat).toBeCloseTo(2.5, 6);
    });

    it('drops a place of the song before, still on its way, once another song plays', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        const first = createSequencedSong(createInstrument());
        const second = createSequencedSong(createInstrument());
        slot.play(first);
        fake.reply(createPlace({ generation: 1, row: 0 }));
        slot.play(second);
        // Sent by the worklet before it heard of the second song
        fake.reply(createPlace({ generation: 1, orderIndex: 0, row: 1 }));
        expect([slot.song, slot.row]).toEqual([second, 0]);
        fake.reply(createPlace({ generation: 2, songId: 2, row: 0 }));
        expect(slot.song).toBe(second);
    });

    it('reports the song gone once a place says it ended', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        slot.play(createSequencedSong(createInstrument()));
        fake.reply(createPlace({ songId: 0 }));
        expect(slot.song).toBeUndefined();
    });

    it('forgets its songs as it resets, and sends a song again after', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
        await controls.ready;
        const slot = audio90.openSongSlot();
        const song = createSequencedSong(createInstrument());
        slot.play(song);
        controls.reset();
        expect(slot.song).toBeUndefined();
        slot.play(song);
        expect(fake.messages.filter((message) => message.kind === 'song')).toHaveLength(2);
    });

    it('clears its scope when they are turned off or the chip resets, and drops a scope that comes after', async () => {
        const fake = createFakeContext('running');
        const { audio90, controls } = createAudio90({ context: fake.context });
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
        const { controls } = createAudio90({ context: fake.context });
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

/** A one-row song on `instrument`, for the sequencer. */
function createSequencedSong(instrument: Audio90Instrument) {
    return createAudio90Song({ bpm: 120, instruments: { s: instrument }, patterns: { p: '| C-4 s' }, order: ['p'] });
}

/** A place of slot 1's first song, as the worklet sends it: playing, at the start, unless `place` says otherwise. */
function createPlace(place: Partial<SongPlaceReply>): SongPlaceReply {
    return { kind: 'song-place', slot: 1, generation: 1, frame: 0, songId: 1, orderIndex: 0, row: 0, beat: 0, tempoScale: 1, ...place };
}

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
