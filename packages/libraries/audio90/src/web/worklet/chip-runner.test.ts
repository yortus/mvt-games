import { describe, expect, it } from 'vitest';
import { createAudio80Sound, createAudio80Song, createCommandAudio80 } from '../../audio80';
import {
    type Audio90Sound, type Audio90SoundData, AUDIO90_SCOPE_LENGTH, AUDIO90_SCOPE_PANS, AUDIO90_SCOPE_POINTS, createAudio90Song, createCommandAudio90,
    DEFAULT_AUDIO90_SOUND, ENGINE_SAMPLE, WAVE90_SAW,
} from '../../audio90';
import { measurePeak } from '../../headless';
import type { ChipBatch, ChipBufferReply, ChipClockReply, CommandWriter } from '../../shared';
import { type Audio80PassedMessage, createAudio80Runner } from './audio80-runner';
import { type Audio90PassedMessage, type Audio90ScopeReply, BLOCKS_PER_SCOPE, createAudio90Runner } from './audio90-runner';
import type { RunnerMessage } from './chip-runner';
import type { SongCall, SongCallMessage, SongPlaceReply } from './song-messages';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCK_MS = BLOCK * 1000 / SAMPLE_RATE;
const TICK_MS = 16;
/** How many blocks of sound play in one frame of the page. Six blocks of 128 samples at 48 kHz last 16 ms. */
const BLOCKS_PER_TICK = Math.round(TICK_MS * SAMPLE_RATE / 1000 / BLOCK);

describe('chip runner, running an Audio80', () => {
    it('plays a note from the next block, and sends each batch\'s buffer back', () => {
        const { runner, writer, send, countHandedBack } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        expect(countHandedBack()).toBe(1);
    });

    it('plays every batch, not just the first, so a note released in the second batch falls silent', () => {
        const { runner, writer, send } = setUp();
        const output = new Float32Array(BLOCK);
        writer.noteOn(0, createAudio80Sound({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } }), 57, 1);
        send();
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        writer.noteOff(0);
        send();
        for (let b = 0; b < 30 * BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBeLessThan(1e-3);
    });

    it('plays on with no batches coming, as through a late frame on the page', () => {
        const { runner, writer, send } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        // Half a second with nothing from the page
        let quietest = Infinity;
        for (let b = 0; b < Math.round(0.5 * SAMPLE_RATE / BLOCK); b++) {
            runner.process([output]);
            quietest = Math.min(quietest, measurePeak(output));
        }
        expect(quietest).toBeGreaterThan(0.01);
    });

    it('reports its clock as it first plays, and again only as it pauses and resumes', () => {
        const { runner, receive, clocks } = setUp();
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        expect(clocks).toEqual([{ kind: 'clock', playheadMs: 0, frame: 0, msPerSample: 1000 / SAMPLE_RATE }]);
        for (let b = 0; b < 9; b++) runner.process([output]);
        expect(clocks).toHaveLength(1);
        receive({ kind: 'pause' });
        runner.process([output]);
        runner.process([output]);
        expect(clocks).toHaveLength(2);
        expect(clocks[1].playheadMs).toBeCloseTo(10 * BLOCK_MS, 9);
        expect(clocks[1]).toMatchObject({ frame: 10 * BLOCK, msPerSample: 0 });
        receive({ kind: 'resume' });
        runner.process([output]);
        expect(clocks).toHaveLength(3);
        // Chip time moves on from where the pause held it
        expect(clocks[2].playheadMs).toBeCloseTo(10 * BLOCK_MS, 9);
        expect(clocks[2]).toMatchObject({ frame: 12 * BLOCK, msPerSample: 1000 / SAMPLE_RATE });
    });

    it('fades out over one block as it pauses, holds the note through the pause, and plays it on as it resumes', () => {
        const { runner, writer, send, receive } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        receive({ kind: 'pause' });
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        expect(Math.abs(output[BLOCK - 1])).toBe(0);
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBe(0);
        receive({ kind: 'resume' });
        runner.process([output]);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0.01);
    });

    it('is silent again after a reset', () => {
        const { runner, writer, send, receive } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        receive({ kind: 'reset' });
        // The first block fades out what was playing. The rest are silent
        for (let i = 0; i < 5; i++) runner.process([output]);
        expect(measurePeak(output)).toBe(0);
    });

    it('fades out over one block after a reset, rather than cutting to 0, which would click', () => {
        const { runner, writer, send, receive } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        for (let b = 0; b < 10 * BLOCKS_PER_TICK; b++) runner.process([output]);
        const last = output[BLOCK - 1];
        expect(Math.abs(last)).toBeGreaterThan(0.01);
        receive({ kind: 'reset' });
        runner.process([output]);
        // It steps down by at most one block's share
        expect(Math.abs(output[0] - last)).toBeLessThanOrEqual(Math.abs(last) / BLOCK + 1e-6);
        expect(output[BLOCK - 1]).toBe(0);
        runner.process([output]);
        expect(measurePeak(output)).toBe(0);
    });

    it('renders silence once stopped, and says so, so the processor can end', () => {
        const { runner, writer, send, receive } = setUp();
        writer.noteOn(0, createAudio80Sound({ wave: 'saw' }), 57, 1);
        send();
        const output = new Float32Array(BLOCK);
        expect(runner.isStopped).toBe(false);
        receive({ kind: 'stop' });
        expect(runner.isStopped).toBe(true);
        runner.process([output]);
        expect(measurePeak(output)).toBe(0);
    });
});

describe('chip runner, running a chip\'s sequencer', () => {
    it('plays a song it was sent, row by row, at the song\'s tempo', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        let loudest = 0;
        for (let b = 0; b < 60 * BLOCKS_PER_TICK; b++) {
            runner.process([left, right]);
            loudest = Math.max(loudest, measurePeak(left));
        }
        expect(loudest).toBeGreaterThan(0.05);
        const rows = places.filter((place) => place.songId === 1);
        expect(rows.length).toBeGreaterThan(4);
        // Each row starts a row's length after the one before, to within a block
        for (let i = 2; i < rows.length; i++) expect(Math.abs(rows[i].frame - rows[i - 1].frame - SEQUENCED_ROW_FRAMES)).toBeLessThanOrEqual(BLOCK);
    });

    it('plays on at the song\'s tempo while nothing comes from the page, as in a late frame', () => {
        const { runner, send, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 20);
        const placesBefore = places.length;
        // A quarter of a second with nothing from the page
        const blocks = Math.round(0.25 * SAMPLE_RATE / BLOCK);
        for (let b = 0; b < blocks; b++) runner.process([left, right]);
        const during = places.slice(placesBefore);
        expect(during.length).toBeGreaterThanOrEqual(Math.floor(0.25 * SAMPLE_RATE / SEQUENCED_ROW_FRAMES) - 1);
        for (let i = 1; i < during.length; i++) expect(Math.abs(during[i].frame - during[i - 1].frame - SEQUENCED_ROW_FRAMES)).toBeLessThanOrEqual(BLOCK);
    });

    it('holds the song while the chip is paused, and plays it on from there as it resumes', () => {
        const { runner, send, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 20);
        const placesBefore = places.length;
        const lastBefore = places.at(-1);
        receive({ kind: 'pause' });
        playTicks(runner, send, left, right, 60);
        expect(places.length).toBe(placesBefore);
        expect(measurePeak(left)).toBe(0);
        receive({ kind: 'resume' });
        playTicks(runner, send, left, right, 20);
        // The row after the one it was held at
        expect(places[placesBefore]?.row).toBe(((lastBefore?.row ?? 0) + 1) % 8);
    });

    it('sends each place with the generation of the last call the sequencer took', () => {
        const { runner, send, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 10);
        expect(places.at(-1)?.generation).toBe(1);
        receive(call({ call: 'play', songId: 1, generation: 2 }));
        playTicks(runner, send, left, right, 10);
        expect(places.at(-1)?.generation).toBe(2);
        expect(places.filter((place) => place.generation === 2)[0]).toMatchObject({ songId: 1, orderIndex: 0, row: 0 });
    });

    it('starts a song from its beginning, however long the chip has played before it hears of it', () => {
        const { runner, send, receive, places, sendSong, call } = setUpAudio90();
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 60);
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        playTicks(runner, send, left, right, 1);
        expect(places.find((place) => place.songId === 1)).toMatchObject({ orderIndex: 0, row: 0 });
    });

    it('stops the song, and forgets every song as it resets', () => {
        const { runner, send, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 20);
        receive(call({ call: 'stop', generation: 2 }));
        playTicks(runner, send, left, right, 2);
        expect(places.at(-1)?.songId).toBe(0);
        receive({ kind: 'reset' });
        receive(call({ call: 'play', songId: 1, generation: 3 }));
        playTicks(runner, send, left, right, 20);
        expect(places.at(-1)?.songId).toBe(0);
    });

    it('runs on the Audio80 too', () => {
        const { runner, receive, places, writer } = setUp();
        const song = createAudio80Song({ bpm: 120, rowsPerBeat: 8, instruments: { s: createAudio80Sound({ wave: 'saw' }) }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'], loop: 0 });
        receive({ kind: 'song', id: 1, song: structuredClone(song), soundIds: song.instruments.map(writer.defineSound) });
        receive({ kind: 'song-call', generation: 1, call: 'play', songId: 1, value: 0 });
        const output = new Float32Array(BLOCK);
        let loudest = 0;
        for (let b = 0; b < 30 * BLOCKS_PER_TICK; b++) {
            runner.process([output]);
            loudest = Math.max(loudest, measurePeak(output));
        }
        expect(loudest).toBeGreaterThan(0.05);
        expect(places.filter((place) => place.songId === 1).length).toBeGreaterThan(2);
    });
});

describe('chip runner, running an Audio90', () => {
    it('renders two channels, so a note panned hard left is silent on the right', () => {
        const { runner, writer, send } = setUpAudio90();
        writer.setVoice(0, 'pan', -1);
        writer.noteOn(0, createAudio90Sound(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 6);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeLessThan(1e-6);
    });

    it('plays a sample sent before the instrument that plays it', () => {
        const { runner, writer, send } = setUpAudio90();
        const data = new Int16Array(SAMPLE_RATE);
        for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 20000);
        // Made by hand, so it is an exact sine rather than a bounce
        const sample = { chip: 'audio90', slices: 1, length: data.length, data: { data, sampleRate: SAMPLE_RATE, rootNote: 69, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } } as const;
        writer.noteOn(0, createAudio90Sound({ engine: ENGINE_SAMPLE }, sample), 69, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 6);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeGreaterThan(0.05);
    });

    it('sends no scope until scopes are on and it has a buffer to send one in', () => {
        const { runner, writer, send, receive, scopes } = setUpAudio90();
        writer.noteOn(0, createAudio90Sound(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scopes', isOn: true });
        playTicks(runner, send, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scope-buffer', data: new Float32Array(AUDIO90_SCOPE_LENGTH) });
        for (let b = 0; b < BLOCKS_PER_SCOPE; b++) runner.process([left, right]);
        expect(scopes).toHaveLength(1);
    });

    it('sends each voice\'s points and pan, every few blocks, in the buffers it is handed', () => {
        const { runner, writer, send, receive, scopes } = setUpAudio90();
        writer.setVoice(3, 'pan', 0.5);
        writer.noteOn(3, createAudio90Sound(), 57, 1);
        receive({ kind: 'scopes', isOn: true });
        const buffers = [0, 1, 2].map(() => new Float32Array(AUDIO90_SCOPE_LENGTH));
        for (const data of buffers) receive({ kind: 'scope-buffer', data });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        // Long enough to send all three
        playTicks(runner, send, left, right, 6);
        expect(scopes).toHaveLength(3);
        const [scope] = scopes;
        expect(buffers).toContain(scope.data);
        const voice3 = scope.data.subarray(3 * AUDIO90_SCOPE_POINTS, 4 * AUDIO90_SCOPE_POINTS);
        expect(Math.max(...voice3.map(Math.abs))).toBeGreaterThan(0.05);
        expect(scope.data[AUDIO90_SCOPE_PANS + 3]).toBeCloseTo(0.5, 6);
        expect(Math.max(...scope.data.subarray(0, AUDIO90_SCOPE_POINTS).map(Math.abs))).toBe(0);
    });

    it('turns its scopes off as it resets', () => {
        const { runner, writer, send, receive, scopes } = setUpAudio90();
        writer.noteOn(0, createAudio90Sound(), 57, 1);
        receive({ kind: 'scopes', isOn: true });
        for (let i = 0; i < 3; i++) receive({ kind: 'scope-buffer', data: new Float32Array(AUDIO90_SCOPE_LENGTH) });
        receive({ kind: 'reset' });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 6);
        expect(scopes).toHaveLength(0);
    });

    it('fades both channels out over one block after a reset', () => {
        const { runner, writer, send, receive } = setUpAudio90();
        writer.noteOn(0, createAudio90Sound(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, send, left, right, 10);
        const lasts = [left[BLOCK - 1], right[BLOCK - 1]];
        expect(Math.min(Math.abs(lasts[0]), Math.abs(lasts[1]))).toBeGreaterThan(0.01);
        receive({ kind: 'reset' });
        runner.process([left, right]);
        expect(Math.abs(left[0] - lasts[0])).toBeLessThanOrEqual(Math.abs(lasts[0]) / BLOCK + 1e-6);
        expect(Math.abs(right[0] - lasts[1])).toBeLessThanOrEqual(Math.abs(lasts[1]) / BLOCK + 1e-6);
        expect([left[BLOCK - 1], right[BLOCK - 1]]).toEqual([0, 0]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp() {
    const buffers: ChipBufferReply[] = [];
    const clocks: ChipClockReply[] = [];
    let returned = 0;
    const places: SongPlaceReply[] = [];
    const runner = createAudio80Runner({
        sampleRate: SAMPLE_RATE,
        sendBack: (reply) => {
            if (reply.kind === 'buffer') {
                buffers.push(reply);
                returned++;
            }
            // The clock's record is reused, so each is copied, as `postMessage` copies it
            else clocks.push({ ...reply });
        },
        sendPlace: (reply) => places.push({ ...reply }),
    });
    const receive = (message: RunnerMessage<Audio80PassedMessage>) => runner.receive(message);
    // With no clock of its own, as the browser's chip has, so each write plays as soon as it arrives
    const writer = createCommandAudio80({
        onSound: (id, data) => receive({ kind: 'sound', id, data }),
        hasClock: false,
    });
    const send = createSend(writer, buffers, receive);
    return { runner, writer, send, receive, places, clocks, countHandedBack: () => returned };
}

/** Sets up an Audio90's runner and writer, as `setUp` does an Audio80's. */
function setUpAudio90() {
    const buffers: ChipBufferReply[] = [];
    const scopes: Audio90ScopeReply[] = [];
    const places: SongPlaceReply[] = [];
    const runner = createAudio90Runner({
        sampleRate: SAMPLE_RATE,
        sendBack: (reply) => {
            if (reply.kind === 'buffer') buffers.push(reply);
        },
        sendScope: (reply) => scopes.push(reply),
        // The record is reused, so each is copied, as `postMessage` copies it
        sendPlace: (reply) => places.push({ ...reply }),
    });
    const receive = (message: RunnerMessage<Audio90PassedMessage>) => runner.receive(message);
    const writer = createCommandAudio90({
        onSound: (id, data) => receive({ kind: 'sound', id, data }),
        // The browser's chip copies a sample rather than moving it
        onSample: (id, data) => receive({ kind: 'sample', id, data: structuredClone(data) }),
        hasClock: false,
    });
    const send = createSend(writer, buffers, receive);
    /** Sends `song` as the page's chip does: its instruments first, then the song, with their ids and none of their samples. */
    const sendSong = (id: number, song: ReturnType<typeof createAudio90Song>) => {
        const soundIds = song.instruments.map(writer.defineSound);
        const instruments = song.instruments.map((instrument) => ({ ...instrument, sample: undefined }));
        receive({ kind: 'song', id, song: structuredClone({ ...song, instruments }), soundIds });
    };
    /** A call to the sequencer. */
    const call = (options: { call: SongCall; generation: number; songId?: number }): SongCallMessage => ({
        kind: 'song-call',
        generation: options.generation,
        call: options.call,
        songId: options.songId ?? 0,
        value: 0,
    });
    return { runner, writer, send, receive, scopes, places, sendSong, call };
}

/**
 * Returns a function that sends the writer's commands as the browser's chip
 * sends them. The buffer is transferred, which detaches the writer's copy.
 * The writer carries on in a buffer that was sent back, if there is one.
 */
function createSend(writer: CommandWriter, buffers: ChipBufferReply[], receive: (batch: ChipBatch) => void): () => void {
    return () => {
        const spare = buffers.pop()?.commands;
        const commands = structuredClone(writer.commands, { transfer: [writer.commands.buffer] });
        receive({ kind: 'batch', commands, count: writer.count });
        writer.clear(spare);
    };
}

/** A song of held saws, a row every eighth of a beat at 120 BPM, so a row every 62.5 ms, that loops. */
const SEQUENCED_SONG = createAudio90Song({
    bpm: 120,
    rowsPerBeat: 8,
    instruments: { s: createAudio90Sound() },
    patterns: { p: ['| C-4 s', '| D-4 s', '| E-4 s', '| F-4 s', '| G-4 s', '| A-4 s', '| B-4 s', '| C-5 s'].join('\n') },
    order: ['p'],
    loop: 0,
});
const SEQUENCED_ROW_FRAMES = 60 / (120 * 8) * SAMPLE_RATE;

/** Runs `ticks` frames of the page, each a send and then a frame's blocks into `left` and `right`. */
function playTicks(runner: { process: (channels: readonly Float32Array[]) => void }, send: () => void, left: Float32Array, right: Float32Array, ticks: number): void {
    for (let tick = 0; tick < ticks; tick++) {
        send();
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
    }
}

/** A saw, held, made by hand, with the sample it plays, if any. */
function createAudio90Sound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sound['sample']): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, wave: WAVE90_SAW, ...data }, sample };
}
