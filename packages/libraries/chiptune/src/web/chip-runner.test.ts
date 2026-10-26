import { describe, expect, it } from 'vitest';
import { createAudio80Instrument, createAudio80Song, createCommandAudio80 } from '../audio80';
import {
    type Audio90Instrument, type Audio90InstrumentData, AUDIO90_SCOPE_LENGTH, AUDIO90_SCOPE_PANS, AUDIO90_SCOPE_POINTS, createAudio90Song, createCommandAudio90,
    DEFAULT_AUDIO90_INSTRUMENT, ENGINE_SAMPLE, WAVE90_SAW,
} from '../audio90';
import { measurePeak } from '../headless';
import type { ChipReply } from '../shared';
import { type Audio80PassedMessage, createAudio80Runner } from './audio80-runner';
import { type Audio90PassedMessage, type Audio90ScopeReply, BLOCKS_PER_SCOPE, createAudio90Runner } from './audio90-runner';
import type { RunnerMessage } from './chip-runner';
import type { SongCall, SongCallMessage, SongPlaceReply } from './song-messages';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const LEAD_MS = 35;
const TICK_MS = 16;
/** How many blocks of sound play in one tick. Six blocks of 128 samples at 48 kHz last 16 ms. */
const BLOCKS_PER_TICK = Math.round(TICK_MS * SAMPLE_RATE / 1000 / BLOCK);

describe('chip runner, running an Audio80', () => {
    it('plays a note once it has a full lead, and sends each batch\'s buffer back', () => {
        const { runner, writer, flush, countHandedBack } = setUp();
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        flush(0);
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        expect(measurePeak(output)).toBe(0);
        for (let tick = 0; tick < 4; tick++) flush(TICK_MS);
        runner.process([output]);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        expect(countHandedBack()).toBeGreaterThan(0);
    });

    it('plays every batch, not just the first, so a note released in the second tick falls silent', () => {
        const { runner, writer, flush } = setUp();
        const output = new Float32Array(BLOCK);
        // Starts the chip's clock at 0, so that the note below sounds for a tick before it is released
        flush(0);
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } }), 57, 1);
        flush(TICK_MS);
        // Written after a batch was sent and before any buffer has come back
        writer.noteOff(0);
        let loudest = 0;
        for (let tick = 0; tick < 30; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) {
                runner.process([output]);
                loudest = Math.max(loudest, measurePeak(output));
            }
        }
        expect(loudest).toBeGreaterThan(0);
        expect(measurePeak(output)).toBeLessThan(1e-3);
    });

    it('keeps a held note sounding through a tick later than its lead, rather than dropping out', () => {
        const { runner, writer, flush } = setUp();
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        const output = new Float32Array(BLOCK);
        for (let tick = 0; tick < 20; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        }
        // No tick for longer than the lead. The clock stalls, and the note rings on
        const blocks = Math.ceil((LEAD_MS + 40) * SAMPLE_RATE / 1000 / BLOCK);
        let quietest = Infinity;
        for (let b = 0; b < blocks; b++) {
            runner.process([output]);
            quietest = Math.min(quietest, measurePeak(output));
        }
        expect(quietest).toBeGreaterThan(0.01);
    });

    it('reports where its clock is with each batch\'s buffer', () => {
        const { runner, flush, lastReply } = setUp();
        const output = new Float32Array(BLOCK);
        for (let tick = 0; tick < 20; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        }
        flush(TICK_MS);
        const reply = lastReply();
        expect(reply.frame).toBe(20 * BLOCKS_PER_TICK * BLOCK);
        expect(reply.playheadMs).toBeGreaterThan(21 * TICK_MS - LEAD_MS - TICK_MS);
        expect(reply.playheadMs).toBeLessThan(21 * TICK_MS - LEAD_MS + TICK_MS);
        expect(reply.msPerSample).toBeCloseTo(1000 / SAMPLE_RATE, 4);
        expect(reply.stallCount).toBe(0);
    });

    it('is silent again after a reset', () => {
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        for (let i = 0; i < 5; i++) flush(TICK_MS);
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        receive({ kind: 'reset' });
        for (let i = 0; i < 5; i++) flush(TICK_MS);
        // The first block fades out what was playing. The rest are silent
        runner.process([output]);
        for (let i = 0; i < 4; i++) runner.process([output]);
        expect(measurePeak(output)).toBe(0);
    });

    it('fades out over one block after a reset, rather than cutting to 0, which would click', () => {
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        const output = new Float32Array(BLOCK);
        for (let tick = 0; tick < 10; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        }
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
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createAudio80Instrument({ wave: 'saw' }), 57, 1);
        for (let i = 0; i < 5; i++) flush(TICK_MS);
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
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        let loudest = 0;
        for (let tick = 0; tick < 60; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) {
                runner.process([left, right]);
                loudest = Math.max(loudest, measurePeak(left));
            }
        }
        expect(loudest).toBeGreaterThan(0.05);
        const rows = places.filter((place) => place.songId === 1);
        expect(rows.length).toBeGreaterThan(4);
        // Each row starts a row's length after the one before, to within a block
        for (let i = 2; i < rows.length; i++) expect(Math.abs(rows[i].frame - rows[i - 1].frame - SEQUENCED_ROW_FRAMES)).toBeLessThanOrEqual(BLOCK);
    });

    it('plays on at the song\'s tempo while the ticks stop coming, as they do in a late frame', () => {
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 20);
        const placesBefore = places.length;
        // A quarter of a second with no tick: far longer than the lead
        const blocks = Math.round(0.25 * SAMPLE_RATE / BLOCK);
        for (let b = 0; b < blocks; b++) runner.process([left, right]);
        const during = places.slice(placesBefore);
        expect(during.length).toBeGreaterThanOrEqual(Math.floor(0.25 * SAMPLE_RATE / SEQUENCED_ROW_FRAMES) - 1);
        for (let i = 1; i < during.length; i++) expect(Math.abs(during[i].frame - during[i - 1].frame - SEQUENCED_ROW_FRAMES)).toBeLessThanOrEqual(BLOCK);
    });

    it('holds the song while the ticks bring no time, as they do while the game is paused', () => {
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 20);
        const placesBefore = places.length;
        for (let tick = 0; tick < 60; tick++) {
            flush(0);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
        }
        // At most the row it was part way into as the pause began
        expect(places.length - placesBefore).toBeLessThanOrEqual(1);
        expect(measurePeak(left)).toBe(0);
    });

    it('sends each place with the generation of the last call its slot took', () => {
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 10);
        expect(places.at(-1)?.generation).toBe(1);
        receive(call({ call: 'play', songId: 1, generation: 2 }));
        playTicks(runner, flush, left, right, 10);
        expect(places.at(-1)?.generation).toBe(2);
        expect(places.filter((place) => place.generation === 2)[0]).toMatchObject({ songId: 1, orderIndex: 0, row: 0 });
    });

    it('skips a song started at a chip time it has played past ahead to where it would have got to, leaving out the notes it passed', () => {
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        // The page asked for the song at chip time 0, but the worklet only hears of it a second later, as when
        // the sound card could not play
        playTicks(runner, flush, left, right, 60);
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1, stampMs: 0 }));
        playTicks(runner, flush, left, right, 1);
        const first = places.find((place) => place.songId === 1);
        // About 60 ticks of 16 ms, less the lead, is well into the song. Where the clock plays exactly moves
        // it by a row at most
        const skippedMs = 60 * TICK_MS - LEAD_MS;
        const rowMs = SEQUENCED_ROW_FRAMES * 1000 / SAMPLE_RATE;
        expect(Math.abs((first?.row ?? 0) - Math.floor(skippedMs / rowMs) % 8)).toBeLessThanOrEqual(1);
        expect(first?.row).toBeGreaterThan(0);
    });

    it('stops the song, and forgets every song as it resets', () => {
        const { runner, flush, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 20);
        receive(call({ call: 'stop', generation: 2 }));
        playTicks(runner, flush, left, right, 2);
        expect(places.at(-1)?.songId).toBe(0);
        receive({ kind: 'reset' });
        receive(call({ call: 'play', songId: 1, generation: 3 }));
        playTicks(runner, flush, left, right, 20);
        expect(places.at(-1)?.songId).toBe(0);
    });

    it('runs on the Audio80 too', () => {
        const { runner, flush, receive, places, writer } = setUp();
        const song = createAudio80Song({ bpm: 120, rowsPerBeat: 8, instruments: { s: createAudio80Instrument({ wave: 'saw' }) }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'], loop: 0 });
        receive({ kind: 'song', id: 1, song: structuredClone(song), instrumentIds: song.instruments.map(writer.defineInstrument) });
        receive({ kind: 'song-call', slot: 1, generation: 1, call: 'play', songId: 1, value: 0, stampMs: writer.time });
        const output = new Float32Array(BLOCK);
        let loudest = 0;
        for (let tick = 0; tick < 30; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) {
                runner.process([output]);
                loudest = Math.max(loudest, measurePeak(output));
            }
        }
        expect(loudest).toBeGreaterThan(0.05);
        expect(places.filter((place) => place.songId === 1).length).toBeGreaterThan(2);
    });
});

describe('chip runner, running an Audio90', () => {
    it('renders two channels, so a note panned hard left is silent on the right', () => {
        const { runner, writer, flush } = setUpAudio90();
        writer.setVoice(0, 'pan', -1);
        writer.noteOn(0, createAudio90Instrument(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        for (let tick = 0; tick < 6; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
        }
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeLessThan(1e-6);
    });

    it('plays a sample sent before the instrument that plays it', () => {
        const { runner, writer, flush } = setUpAudio90();
        const data = new Int16Array(SAMPLE_RATE);
        for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 20000);
        // Made by hand, so it is an exact sine rather than a bounce
        const sample = { chip: 'audio90', slices: 1, length: data.length, data: { data, sampleRate: SAMPLE_RATE, rootNote: 69, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } } as const;
        writer.noteOn(0, createAudio90Instrument({ engine: ENGINE_SAMPLE }, sample), 69, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        for (let tick = 0; tick < 6; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
        }
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeGreaterThan(0.05);
    });

    it('sends no scope until scopes are on and it has a buffer to send one in', () => {
        const { runner, writer, flush, receive, scopes } = setUpAudio90();
        writer.noteOn(0, createAudio90Instrument(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scopes', isOn: true });
        playTicks(runner, flush, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scope-buffer', data: new Float32Array(AUDIO90_SCOPE_LENGTH) });
        for (let b = 0; b < BLOCKS_PER_SCOPE; b++) runner.process([left, right]);
        expect(scopes).toHaveLength(1);
    });

    it('sends each voice\'s points and pan, every few blocks, in the buffers it is handed', () => {
        const { runner, writer, flush, receive, scopes } = setUpAudio90();
        writer.setVoice(3, 'pan', 0.5);
        writer.noteOn(3, createAudio90Instrument(), 57, 1);
        receive({ kind: 'scopes', isOn: true });
        const buffers = [0, 1, 2].map(() => new Float32Array(AUDIO90_SCOPE_LENGTH));
        for (const data of buffers) receive({ kind: 'scope-buffer', data });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        // Past the clock's lead, which is silent, and long enough to send all three
        playTicks(runner, flush, left, right, 6);
        expect(scopes).toHaveLength(3);
        const [scope] = scopes;
        expect(buffers).toContain(scope.data);
        const voice3 = scope.data.subarray(3 * AUDIO90_SCOPE_POINTS, 4 * AUDIO90_SCOPE_POINTS);
        expect(Math.max(...voice3.map(Math.abs))).toBeGreaterThan(0.05);
        expect(scope.data[AUDIO90_SCOPE_PANS + 3]).toBeCloseTo(0.5, 6);
        expect(Math.max(...scope.data.subarray(0, AUDIO90_SCOPE_POINTS).map(Math.abs))).toBe(0);
    });

    it('turns its scopes off as it resets', () => {
        const { runner, writer, flush, receive, scopes } = setUpAudio90();
        writer.noteOn(0, createAudio90Instrument(), 57, 1);
        receive({ kind: 'scopes', isOn: true });
        for (let i = 0; i < 3; i++) receive({ kind: 'scope-buffer', data: new Float32Array(AUDIO90_SCOPE_LENGTH) });
        receive({ kind: 'reset' });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, flush, left, right, 6);
        expect(scopes).toHaveLength(0);
    });

    it('fades both channels out over one block after a reset', () => {
        const { runner, writer, flush, receive } = setUpAudio90();
        writer.noteOn(0, createAudio90Instrument(), 57, 1);
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        for (let tick = 0; tick < 10; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
        }
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
    const replies: ChipReply[] = [];
    let returned = 0;
    let last: ChipReply | undefined;
    const places: SongPlaceReply[] = [];
    const runner = createAudio80Runner({
        sampleRate: SAMPLE_RATE,
        leadMs: LEAD_MS,
        sendBack: (reply) => {
            replies.push(reply);
            last = reply;
            returned++;
        },
        // The record is reused, so each is copied, as `postMessage` copies it
        sendPlace: (reply) => places.push({ ...reply }),
    });
    const receive = (message: RunnerMessage<Audio80PassedMessage>) => runner.receive(message);
    const writer = createCommandAudio80({
        onInstrument: (id, data) => receive({ kind: 'instrument', id, data }),
        onEffect: (id, data) => receive({ kind: 'effect', id, data }),
    });
    /**
     * Runs one tick. It advances the chip's clock, then sends its writes as
     * the browser's chip sends them. The buffer is transferred, which detaches
     * the writer's copy. The writer carries on in a buffer that was sent back,
     * if there is one. A buffer comes back by message, so never before the
     * next tick. So the spare is taken before this tick's batch is sent.
     */
    const flush = (deltaMs: number) => {
        writer.update(deltaMs);
        const spare = replies.pop()?.commands;
        const commands = structuredClone(writer.commands, { transfer: [writer.commands.buffer] });
        receive({ kind: 'batch', commands, count: writer.count, horizonMs: writer.time });
        writer.clear(spare);
    };
    return { runner, writer, flush, receive, places, countHandedBack: () => returned, lastReply: () => last! };
}

/** Sets up an Audio90's runner and writer, as `setUp` does an Audio80's. */
function setUpAudio90() {
    const replies: ChipReply[] = [];
    const scopes: Audio90ScopeReply[] = [];
    const places: SongPlaceReply[] = [];
    const runner = createAudio90Runner({
        sampleRate: SAMPLE_RATE,
        leadMs: LEAD_MS,
        sendBack: (reply) => replies.push(reply),
        sendScope: (reply) => scopes.push(reply),
        // The record is reused, so each is copied, as `postMessage` copies it
        sendPlace: (reply) => places.push({ ...reply }),
    });
    const receive = (message: RunnerMessage<Audio90PassedMessage>) => runner.receive(message);
    const writer = createCommandAudio90({
        onInstrument: (id, data) => receive({ kind: 'instrument', id, data }),
        onEffect: (id, data) => receive({ kind: 'effect', id, data }),
        // The browser's chip copies a sample rather than moving it
        onSample: (id, data) => receive({ kind: 'sample', id, data: structuredClone(data) }),
    });
    const flush = (deltaMs: number) => {
        writer.update(deltaMs);
        const spare = replies.pop()?.commands;
        const commands = structuredClone(writer.commands, { transfer: [writer.commands.buffer] });
        receive({ kind: 'batch', commands, count: writer.count, horizonMs: writer.time });
        writer.clear(spare);
    };
    /** Sends `song` as the page's chip does: its instruments first, then the song, with their ids and none of their samples. */
    const sendSong = (id: number, song: ReturnType<typeof createAudio90Song>) => {
        const instrumentIds = song.instruments.map(writer.defineInstrument);
        const instruments = song.instruments.map((instrument) => ({ ...instrument, sample: undefined }));
        receive({ kind: 'song', id, song: structuredClone({ ...song, instruments }), instrumentIds });
    };
    /** A call to slot 1, stamped with the chip's time unless `stampMs` says otherwise. */
    const call = (options: { call: SongCall; generation: number; songId?: number; stampMs?: number }): SongCallMessage => ({
        kind: 'song-call',
        slot: 1,
        generation: options.generation,
        call: options.call,
        songId: options.songId ?? 0,
        value: 0,
        stampMs: options.stampMs ?? writer.time,
    });
    return { runner, writer, flush, receive, scopes, places, sendSong, call };
}

/** A song of held saws, a row every eighth of a beat at 120 BPM, so a row every 62.5 ms, that loops. */
const SEQUENCED_SONG = createAudio90Song({
    bpm: 120,
    rowsPerBeat: 8,
    instruments: { s: createAudio90Instrument() },
    patterns: { p: ['| C-4 s', '| D-4 s', '| E-4 s', '| F-4 s', '| G-4 s', '| A-4 s', '| B-4 s', '| C-5 s'].join('\n') },
    order: ['p'],
    loop: 0,
});
const SEQUENCED_ROW_FRAMES = 60 / (120 * 8) * SAMPLE_RATE;

/** Runs `ticks` ticks, each a flush and then a tick's blocks into `left` and `right`. */
function playTicks(runner: { process: (channels: readonly Float32Array[]) => void }, flush: (deltaMs: number) => void, left: Float32Array, right: Float32Array, ticks: number): void {
    for (let tick = 0; tick < ticks; tick++) {
        flush(TICK_MS);
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([left, right]);
    }
}

/** A saw, held, made by hand, with the sample it plays, if any. */
function createAudio90Instrument(data: Partial<Audio90InstrumentData> = {}, sample?: Audio90Instrument['sample']): Audio90Instrument {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_INSTRUMENT, wave: WAVE90_SAW, ...data }, sample };
}
