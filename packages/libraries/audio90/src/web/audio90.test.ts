import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    type Audio90Sound,
    createAudio90Song,
    type Audio90SoundData,
    type Audio90Sample,
    type Audio90Song,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_SAMPLE,
} from '../audio90';
import { installFakeAudioContext, FAKE_BASE_LATENCY_S, FAKE_OUTPUT_LATENCY_S, FAKE_SAMPLE_RATE } from './fake-audio-context.test-support';
import { AUDIO90_PROCESSOR_NAME, type SongMessage, type SongPlaceReply } from './worklet';
import { createAudio90 } from './audio90';

describe('createAudio90, with a stand-in audio context', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('makes a node of its own processor, with two output channels', async () => {
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context, character: 'console' });
        await audio90.ready;
        expect(fake.processorNames).toEqual([AUDIO90_PROCESSOR_NAME]);
        expect(fake.nodeOptions[0].outputChannelCount).toEqual([2]);
        expect(fake.nodeOptions[0].processorOptions).toEqual({ character: 'console' });
    });

    it('sends a sample once, before the first sound that plays it, and keeps its own copy', async () => {
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const sample = createSample();
        audio90.play(createSound({ engine: ENGINE_SAMPLE }, sample));
        audio90.play(createSound({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample));
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'sound', 'play', 'sound', 'play']);
        expect(sample.data.data.length).toBe(SAMPLE_LENGTH);
    });

    it('sends the sounds first played before the worklet ran, once it runs, in order', async () => {
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        audio90.play(createSound({ engine: ENGINE_SAMPLE }, createSample()));
        await audio90.ready;
        expect(fake.messages.map((message) => message.kind)).toEqual(['sample', 'sound']);
    });

    it('sends a song once, after its instruments and without their samples, then each call to its sequencer', async () => {
        const fake = installFakeAudioContext('running');
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
        expect(fake.listMessages('song-call').at(-1)).toMatchObject({ call: 'stop', generation: 3 });
        audio90.tempoScale = 0.5;
        expect(fake.listMessages('song-call').at(-1)).toMatchObject({ call: 'stop' });
    });

    it('says the song asked for is at its start until a place of it reaches the speaker, then which row is heard', async () => {
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        expect(audio90.song).toBeUndefined();
        const song = createSequencedSong(createSound());
        audio90.play(song);
        expect([audio90.song, audio90.orderIndex, audio90.row]).toEqual([song, 0, 0]);
        // The speaker trails the context's count by its latency
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
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.play(createSequencedSong(createSound()));
        fake.reply(createPlace({ frame: 0, beat: 2, tempoScale: 0.5 }));
        const lagFrames = (FAKE_BASE_LATENCY_S + FAKE_OUTPUT_LATENCY_S) * FAKE_SAMPLE_RATE;
        // Half a second after the place, at half the song's 120 BPM, is half a beat on
        fake.setCurrentTime((FAKE_SAMPLE_RATE / 2 + lagFrames) / FAKE_SAMPLE_RATE);
        expect(audio90.beat).toBeCloseTo(2.5, 6);
    });

    it('drops a place of the song before, still on its way, once another song plays', async () => {
        const fake = installFakeAudioContext('running');
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
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        audio90.play(createSequencedSong(createSound()));
        // Long after the place, so it has reached the speaker
        fake.setCurrentTime(1);
        fake.reply(createPlace({ songId: 0 }));
        expect(audio90.song).toBeUndefined();
    });

    it('stops the song with its play\'s id, and leaves a song played since alone', async () => {
        const fake = installFakeAudioContext('running');
        const audio90 = createAudio90({ context: fake.context });
        await audio90.ready;
        const first = audio90.play(createSequencedSong(createSound()));
        const second = audio90.play(createSequencedSong(createSound()));
        audio90.stop(first);
        expect(fake.listMessages('song-call').at(-1)).toMatchObject({ call: 'play' });
        audio90.stop(second);
        expect(fake.listMessages('song-call').at(-1)).toMatchObject({ call: 'stop' });
        expect(audio90.song).toBeUndefined();
    });

    it('forgets its songs as everything is stopped while paused, and sends a song again after', async () => {
        const fake = installFakeAudioContext('running');
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

/** A sound made by hand: its data, with the sample it plays, if any. */
function createSound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sample): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, ...data }, sample };
}

/** A sample made by hand, of silence, with nothing to bounce. */
function createSample(): Audio90Sample {
    return { chip: 'audio90', slices: 1, length: SAMPLE_LENGTH, data: { data: new Int16Array(SAMPLE_LENGTH), sampleRate: 32000, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } };
}
