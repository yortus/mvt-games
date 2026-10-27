import { describe, expect, it } from 'vitest';
import { createChipPlayback } from './chip-playback';
import type { SongSequencer } from './sound-chip';
import type { SongTiming } from './tracker';

describe('a chip\'s playback', () => {
    it('starts a song it is asked to queue at once when nothing plays, and after the song playing otherwise', () => {
        const { playback, songs, calls } = createPlaybackOnStandIns();
        const first = playback.queue(SONG_A);
        songs.song = SONG_A;
        const second = playback.queue(SONG_B);
        expect(playback.song).toBe(SONG_A);
        expect(calls).toEqual(['queue song a', 'queue song b']);
        expect(second).toBe(first);
    });

    it('passes each call to the sequencer as it is made, and the tempo only when it changes', () => {
        const { playback, calls } = createPlaybackOnStandIns();
        playback.play(SONG_A);
        playback.stop();
        playback.play(SONG_B);
        playback.tempoScale = 0.5;
        expect(calls).toEqual(['play song a', 'stop song', 'stop voices', 'play song b', 'tempo 0.5']);
        playback.tempoScale = 0.5;
        playback.tempoScale = -1;
        expect(calls.slice(5)).toEqual(['tempo 0']);
        expect(playback.tempoScale).toBe(0);
    });

    it('reports where the sequencer says the song heard has got to', () => {
        const { playback, songs } = createPlaybackOnStandIns();
        playback.play(SONG_A);
        songs.song = SONG_A;
        songs.orderIndex = 1;
        songs.row = 3;
        songs.beat = 4.5;
        expect([playback.song, playback.orderIndex, playback.row, playback.beat]).toEqual([SONG_A, 1, 3, 4.5]);
    });

    it('numbers songs and sounds from one count, so each play has an id of its own', () => {
        const { playback } = createPlaybackOnStandIns();
        expect([playback.play(SONG_A), playback.play(ZAP), playback.play(SONG_B)]).toEqual([1, 2, 3]);
    });

    it('stops a song by its id, and a sound by its own', () => {
        const { playback, calls } = createPlaybackOnStandIns();
        const song = playback.play(SONG_A);
        const zap = playback.play(ZAP);
        calls.length = 0;
        playback.stop(zap);
        playback.stop(song);
        expect(calls).toEqual([`stop sound ${zap}`, 'stop song']);
    });

    it('leaves a song played since alone, when asked to stop an older song', () => {
        const { playback, calls } = createPlaybackOnStandIns();
        const old = playback.play(SONG_A);
        playback.play(SONG_B);
        calls.length = 0;
        playback.stop(old);
        expect(calls).toEqual([`stop sound ${old}`]);
    });

    it('stops nothing for an id no play has, even with no song asked for', () => {
        const { playback, calls } = createPlaybackOnStandIns();
        playback.stop(0);
        expect(calls).toEqual(['stop sound 0']);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** What the stand-in chip plays as a sound: anything with no order of patterns. */
const ZAP = { kind: 'zap' } as const;
type StandInSound = typeof ZAP;

/** A stand-in song, which has an order of patterns, as every song has. */
function createSong(name: string): StandInSong {
    return { name, bpm: 120, rowsPerBeat: 4, order: [], patterns: [] };
}
interface StandInSong extends SongTiming {
    readonly name: string;
}
const SONG_A = createSong('song a');
const SONG_B = createSong('song b');

/** A chip's playback on a sequencer whose place a test sets, which notes each call made to it and to the sound side. */
function createPlaybackOnStandIns() {
    const calls: string[] = [];
    let nextPlayId = 1;
    const songs: { -readonly [K in keyof SongSequencer<StandInSong>]: SongSequencer<StandInSong>[K] } = {
        song: undefined,
        orderIndex: 0,
        row: 0,
        beat: 0,
        play: (song) => calls.push(`play ${song.name}`),
        queue: (song) => calls.push(`queue ${song.name}`),
        stop: () => calls.push('stop song'),
        setTempoScale: (scale) => calls.push(`tempo ${scale}`),
    };
    const playback = createChipPlayback<StandInSong, StandInSound, undefined>({
        songs,
        playSound: () => nextPlayId++,
        stopSound: (id) => calls.push(`stop sound ${id}`),
        takePlayId: () => nextPlayId++,
        stopVoices: () => calls.push('stop voices'),
    });
    return { playback, songs, calls };
}
