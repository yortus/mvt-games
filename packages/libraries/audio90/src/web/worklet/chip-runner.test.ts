import { describe, expect, it } from 'vitest';
import { type Audio80PlayOptions, type Audio80Sound, createAudio80Song, createAudio80Sound, createAudio80SoundIds } from '../../audio80';
import {
    type Audio90PlayOptions,
    type Audio90Sound,
    type Audio90SoundData,
    AUDIO90_VOICE_COUNT,
    createAudio90Song,
    createAudio90SoundIds,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_SAMPLE,
    WAVE90_SAW,
} from '../../audio90';
import { measurePeak } from '../../headless';
import { checkPlay, SCOPE_POINTS, toScopeLength } from '../../shared';
import { type Audio80PassedMessage, createAudio80Runner } from './audio80-runner';
import { type Audio90PassedMessage, createAudio90Runner } from './audio90-runner';
import { BLOCKS_PER_SCOPE, type RunnerMessage, type ScopeReply } from './chip-runner';
import type { SongCall, SongCallMessage, SongPlaceReply } from './song-messages';

const SAMPLE_RATE = 48000;
/** How many numbers an Audio90's scope holds, and where its pans start. */
const SCOPE_LENGTH = toScopeLength(AUDIO90_VOICE_COUNT);
const SCOPE_PANS = AUDIO90_VOICE_COUNT * SCOPE_POINTS;
const BLOCK = 128;
const TICK_MS = 16;
/** How many blocks of sound play in one frame of the page. Six blocks of 128 samples at 48 kHz last 16 ms. */
const BLOCKS_PER_TICK = Math.round(TICK_MS * SAMPLE_RATE / 1000 / BLOCK);

describe('chip runner, running an Audio80', () => {
    it('plays a sound from the next block', () => {
        const { runner, play } = setUp();
        play(createAudio80Sound({ wave: 'saw' }), { note: 57, lengthMs: Infinity });
        const output = new Float32Array(BLOCK);
        runner.process([output]);
        runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
    });

    it('stops a play, so its note falls silent', () => {
        const { runner, play, receive } = setUp();
        const output = new Float32Array(BLOCK);
        const id = play(createAudio80Sound({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } }), { lengthMs: Infinity });
        for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBeGreaterThan(0);
        receive({ kind: 'stop', id });
        for (let b = 0; b < 30 * BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBeLessThan(1e-3);
    });

    it('releases every voice on a release-all', () => {
        const { runner, play, receive } = setUp();
        const output = new Float32Array(BLOCK);
        const sound = createAudio80Sound({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } });
        play(sound, { lengthMs: Infinity });
        play(sound, { note: 'E-4', lengthMs: Infinity });
        receive({ kind: 'release-all' });
        for (let b = 0; b < 30 * BLOCKS_PER_TICK; b++) runner.process([output]);
        expect(measurePeak(output)).toBeLessThan(1e-3);
    });

    it('plays on with nothing coming from the page, as through a late frame', () => {
        const { runner, play } = setUp();
        play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
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

    it('fades out over one block as it pauses, holds the note through the pause, and plays it on as it resumes', () => {
        const { runner, play, receive } = setUp();
        play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
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

    it('fades out over one block after a reset, rather than cutting to 0, which would click, and is silent after', () => {
        const { runner, play, receive } = setUp();
        play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
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

    it('renders silence once destroyed, and says so, so the processor can end', () => {
        const { runner, play, receive } = setUp();
        play(createAudio80Sound({ wave: 'saw' }), { lengthMs: Infinity });
        const output = new Float32Array(BLOCK);
        expect(runner.isDestroyed).toBe(false);
        receive({ kind: 'destroy' });
        expect(runner.isDestroyed).toBe(true);
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
        expectRowsApart(rows, SEQUENCED_ROW_FRAMES);
    });

    it('plays on at the song\'s tempo while nothing comes from the page, as in a late frame', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 20);
        const placesBefore = places.length;
        // A quarter of a second with nothing from the page
        const blocks = Math.round(0.25 * SAMPLE_RATE / BLOCK);
        for (let b = 0; b < blocks; b++) runner.process([left, right]);
        const during = places.slice(placesBefore);
        expect(during.length).toBeGreaterThanOrEqual(Math.floor(0.25 * SAMPLE_RATE / SEQUENCED_ROW_FRAMES) - 1);
        expectRowsApart(during, SEQUENCED_ROW_FRAMES);
    });

    it('plays at the tempo scale a call sets, from the next block', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 10);
        receive({ ...call({ call: 'tempo', generation: 2 }), value: 2 });
        const placesBefore = places.length;
        playTicks(runner, left, right, 30);
        const faster = places.slice(placesBefore + 1);
        expect(faster.length).toBeGreaterThan(4);
        expectRowsApart(faster, SEQUENCED_ROW_FRAMES / 2);
        expect(faster.at(-1)?.tempoScale).toBe(2);
    });

    it('plays a queued song as the one playing ends, without a gap', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        const once = createAudio90Song({ bpm: 120, rowsPerBeat: 8, instruments: { s: createAudio90Sound() }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'] });
        sendSong(1, once);
        sendSong(2, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        receive(call({ call: 'queue', songId: 2, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 20);
        const first = places.filter((place) => place.songId === 1);
        const next = places.find((place) => place.songId === 2);
        expect(first.map((place) => place.row)).toEqual([0, 1]);
        // The queued song's first row starts a row after the first song's last
        expect(Math.abs((next?.frame ?? 0) - first[1].frame - SEQUENCED_ROW_FRAMES)).toBeLessThanOrEqual(BLOCK);
    });

    it('holds the song while the chip is paused, and plays it on from there as it resumes', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 20);
        const placesBefore = places.length;
        const lastBefore = places.at(-1);
        receive({ kind: 'pause' });
        playTicks(runner, left, right, 60);
        expect(places.length).toBe(placesBefore);
        expect(measurePeak(left)).toBe(0);
        receive({ kind: 'resume' });
        playTicks(runner, left, right, 20);
        // The row after the one it was held at
        expect(places[placesBefore]?.row).toBe(((lastBefore?.row ?? 0) + 1) % 8);
    });

    it('sends each place with the generation of the last call the sequencer took', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 10);
        expect(places.at(-1)?.generation).toBe(1);
        receive(call({ call: 'play', songId: 1, generation: 2 }));
        playTicks(runner, left, right, 10);
        expect(places.at(-1)?.generation).toBe(2);
        expect(places.filter((place) => place.generation === 2)[0]).toMatchObject({ songId: 1, orderIndex: 0, row: 0 });
    });

    it('starts a song from its beginning, however long the chip has played before it hears of it', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 60);
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        playTicks(runner, left, right, 1);
        expect(places.find((place) => place.songId === 1)).toMatchObject({ orderIndex: 0, row: 0 });
    });

    it('stops the song, and forgets every song as it resets', () => {
        const { runner, receive, places, sendSong, call } = setUpAudio90();
        sendSong(1, SEQUENCED_SONG);
        receive(call({ call: 'play', songId: 1, generation: 1 }));
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 20);
        receive(call({ call: 'stop', generation: 2 }));
        playTicks(runner, left, right, 2);
        expect(places.at(-1)?.songId).toBe(0);
        receive({ kind: 'reset' });
        receive(call({ call: 'play', songId: 1, generation: 3 }));
        playTicks(runner, left, right, 20);
        expect(places.at(-1)?.songId).toBe(0);
    });

    it('runs on the Audio80 too', () => {
        const { runner, receive, places, soundIds } = setUp();
        const song = createAudio80Song({ bpm: 120, rowsPerBeat: 8, instruments: { s: createAudio80Sound({ wave: 'saw' }) }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'], loop: 0 });
        receive({ kind: 'song', id: 1, song: structuredClone(song), soundIds: song.instruments.map(soundIds.soundId) });
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
    it('renders two channels, so a sound played hard left is silent on the right', () => {
        const { runner, play } = setUpAudio90();
        play(createAudio90Sound(), { pan: -1, lengthMs: Infinity });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 6);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeLessThan(1e-6);
    });

    it('plays a sample sent before the sound that plays it', () => {
        const { runner, play } = setUpAudio90();
        const data = new Int16Array(SAMPLE_RATE);
        for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 20000);
        // Made by hand, so it is an exact sine rather than a bounce
        const sample = { chip: 'audio90', slices: 1, length: data.length, data: { data, sampleRate: SAMPLE_RATE, rootNote: 69, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } } as const;
        play(createAudio90Sound({ engine: ENGINE_SAMPLE }, sample), { note: 69, lengthMs: Infinity });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 6);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeGreaterThan(0.05);
    });

    it('sends no scope until scopes are on and it has a buffer to send one in', () => {
        const { runner, play, receive, scopes } = setUpAudio90();
        play(createAudio90Sound(), { lengthMs: Infinity });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scopes', isOn: true });
        playTicks(runner, left, right, 4);
        expect(scopes).toHaveLength(0);
        receive({ kind: 'scope-buffer', data: new Float32Array(SCOPE_LENGTH) });
        for (let b = 0; b < BLOCKS_PER_SCOPE; b++) runner.process([left, right]);
        expect(scopes).toHaveLength(1);
    });

    it('sends each voice\'s points and pan, every few blocks, in the buffers it is handed', () => {
        const { runner, play, receive, scopes } = setUpAudio90();
        play(createAudio90Sound(), { pan: 0.5, lengthMs: Infinity });
        receive({ kind: 'scopes', isOn: true });
        const buffers = [0, 1, 2].map(() => new Float32Array(SCOPE_LENGTH));
        for (const data of buffers) receive({ kind: 'scope-buffer', data });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        // Long enough to send all three
        playTicks(runner, left, right, 6);
        expect(scopes).toHaveLength(3);
        const [scope] = scopes;
        expect(buffers).toContain(scope.data);
        // The one voice playing has points, at the pan it was played at, and the others are silent
        const sounding: number[] = [];
        for (let v = 0; v < AUDIO90_VOICE_COUNT; v++) {
            const points = scope.data.subarray(v * SCOPE_POINTS, (v + 1) * SCOPE_POINTS);
            if (Math.max(...points.map(Math.abs)) > 0.05) sounding.push(v);
        }
        expect(sounding).toHaveLength(1);
        expect(scope.data[SCOPE_PANS + sounding[0]]).toBeCloseTo(0.5, 6);
    });

    it('turns its scopes off as it resets', () => {
        const { runner, play, receive, scopes } = setUpAudio90();
        play(createAudio90Sound(), { lengthMs: Infinity });
        receive({ kind: 'scopes', isOn: true });
        for (let i = 0; i < 3; i++) receive({ kind: 'scope-buffer', data: new Float32Array(SCOPE_LENGTH) });
        receive({ kind: 'reset' });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 6);
        expect(scopes).toHaveLength(0);
    });

    it('fades both channels out over one block after a reset', () => {
        const { runner, play, receive } = setUpAudio90();
        play(createAudio90Sound(), { lengthMs: Infinity });
        const left = new Float32Array(BLOCK);
        const right = new Float32Array(BLOCK);
        playTicks(runner, left, right, 10);
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

/** Sets up an Audio80's runner, with what the page sends it: its sounds, its plays and its songs. */
function setUp() {
    const places: SongPlaceReply[] = [];
    const runner = createAudio80Runner({
        sampleRate: SAMPLE_RATE,
        sendScope: ignore,
        // The record is reused, so each is copied, as `postMessage` copies it
        sendPlace: (reply) => places.push({ ...reply }),
    });
    const receive = (message: RunnerMessage<Audio80PassedMessage>) => runner.receive(structuredClone(message));
    const soundIds = createAudio80SoundIds({ onSound: (id, data) => receive({ kind: 'sound', id, data }) });
    let nextPlayId = 1;
    /** Plays `sound` as the page's chip does, and returns the play's id. */
    const play = (sound: Audio80Sound, options?: Audio80PlayOptions): number => {
        const id = nextPlayId++;
        receive({ kind: 'play', soundId: soundIds.soundId(sound), id, ...checkPlay(sound.data, options) });
        return id;
    };
    return { runner, receive, play, places, soundIds };
}

/** Sets up an Audio90's runner, as `setUp` does an Audio80's. */
function setUpAudio90() {
    const scopes: ScopeReply[] = [];
    const places: SongPlaceReply[] = [];
    const runner = createAudio90Runner({
        sampleRate: SAMPLE_RATE,
        sendScope: (reply) => scopes.push(reply),
        // The record is reused, so each is copied, as `postMessage` copies it
        sendPlace: (reply) => places.push({ ...reply }),
    });
    // Each message is copied, as `postMessage` copies it, apart from a scope's buffer, which is moved
    const receive = (message: RunnerMessage<Audio90PassedMessage>) => runner.receive(message.kind === 'scope-buffer' ? message : structuredClone(message));
    const soundIds = createAudio90SoundIds({
        onSound: (id, data) => receive({ kind: 'sound', id, data }),
        onSample: (id, data) => receive({ kind: 'sample', id, data }),
    });
    let nextPlayId = 1;
    /** Plays `sound` as the page's chip does, and returns the play's id. */
    const play = (sound: Audio90Sound, options?: Audio90PlayOptions): number => {
        const id = nextPlayId++;
        receive({ kind: 'play', soundId: soundIds.soundId(sound), id, ...checkPlay(sound.data, options) });
        return id;
    };
    /** Sends `song` as the page's chip does: its instruments first, then the song, with their ids and none of their samples. */
    const sendSong = (id: number, song: ReturnType<typeof createAudio90Song>) => {
        const songSoundIds = song.instruments.map(soundIds.soundId);
        const instruments = song.instruments.map((instrument) => ({ ...instrument, sample: undefined }));
        receive({ kind: 'song', id, song: { ...song, instruments }, soundIds: songSoundIds });
    };
    /** A call to the sequencer. */
    const call = (options: { call: SongCall; generation: number; songId?: number }): SongCallMessage => ({
        kind: 'song-call',
        generation: options.generation,
        call: options.call,
        songId: options.songId ?? 0,
        value: 0,
    });
    return { runner, receive, play, scopes, places, sendSong, call };
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

/** Runs `ticks` frames' worth of blocks into `left` and `right`. */
function playTicks(runner: { process: (channels: readonly Float32Array[]) => void }, left: Float32Array, right: Float32Array, ticks: number): void {
    for (let b = 0; b < ticks * BLOCKS_PER_TICK; b++) runner.process([left, right]);
}

/** Expects each place to start `rowFrames` after the one before, to within a block. */
function expectRowsApart(places: readonly SongPlaceReply[], rowFrames: number): void {
    for (let i = 1; i < places.length; i++) expect(Math.abs(places[i].frame - places[i - 1].frame - rowFrames)).toBeLessThanOrEqual(BLOCK);
}

/** A saw, held, made by hand, with the sample it plays, if any. */
function createAudio90Sound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sound['sample']): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, wave: WAVE90_SAW, ...data }, sample };
}

function ignore(): void {
    // The Audio80's tests here send no scopes
}
