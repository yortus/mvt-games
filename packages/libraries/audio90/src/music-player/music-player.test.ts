import { describe, expect, it } from 'vitest';
import { type Audio80, type Audio80Song, type Audio80Writer, createAudio80Sound, createAudio80Song } from '../audio80';
import { type Audio80Write, createHeadlessAudio80 } from '../headless';
import type { SongSlot } from '../shared';
import { createMusicPlayer } from './music-player';
import { createSongPlayer } from './song-player';

const TICK_MS = 16;

describe('music player', () => {
    it('plays on a headless chip the same notes, at the same times, as the song player it runs there', () => {
        const viaMusic = createHeadlessAudio80({ record: true });
        const music = createMusicPlayer({ audio80: viaMusic.audio80 });
        music.play(SONG);
        const viaSong = createHeadlessAudio80({ record: true });
        const song = createSongPlayer({ audio80: asWriter(viaSong.audio80) });
        song.play(SONG);
        song.refresh();
        for (let i = 0; i < 40; i++) {
            viaMusic.controls.update(TICK_MS);
            viaSong.controls.update(TICK_MS);
            song.update(TICK_MS);
            song.refresh();
        }
        expect(describeNoteOns(viaMusic.audio80.log)).toEqual(describeNoteOns(viaSong.audio80.log));
        expect(describeNoteOns(viaMusic.audio80.log).length).toBeGreaterThan(4);
    });

    it('answers with the song it was asked for at once, and from its start', () => {
        const { audio80, controls } = createHeadlessAudio80();
        const music = createMusicPlayer({ audio80 });
        music.play(SONG);
        for (let i = 0; i < 20; i++) controls.update(TICK_MS);
        expect(music.row).toBeGreaterThan(0);
        music.play(OTHER_SONG);
        expect([music.song, music.isPlaying, music.orderIndex, music.row, music.beat]).toEqual([OTHER_SONG, true, 0, 0, 0]);
        music.stop();
        expect([music.song, music.isPlaying]).toEqual([undefined, false]);
    });

    it('starts a song it is asked to queue at once when nothing plays, and after the song playing otherwise', () => {
        const { slot, calls } = createSlotStandIn();
        const music = createMusicPlayer({ audio80: createChipOn(slot) });
        music.queue(SONG);
        slot.song = SONG;
        music.queue(OTHER_SONG);
        expect(music.song).toBe(SONG);
        expect(calls).toEqual(['queue', 'queue']);
    });

    it('passes each call to its slot as it is made, and the tempo only when it changes', () => {
        const { slot, calls } = createSlotStandIn();
        const music = createMusicPlayer({ audio80: createChipOn(slot) });
        music.play(SONG);
        music.stop();
        music.play(OTHER_SONG);
        music.tempoScale = 0.5;
        expect(calls).toEqual(['play', 'stop', 'play', 'tempo 0.5']);
        music.tempoScale = 0.5;
        music.tempoScale = -1;
        expect(calls.slice(4)).toEqual(['tempo 0']);
        expect(music.tempoScale).toBe(0);
    });

    it('starts a song on a headless chip at the tempo set after it, as the song player does with the tempo set first', () => {
        const viaMusic = createHeadlessAudio80({ record: true });
        const music = createMusicPlayer({ audio80: viaMusic.audio80 });
        music.play(SONG);
        music.tempoScale = 2;
        const viaSong = createHeadlessAudio80({ record: true });
        const song = createSongPlayer({ audio80: asWriter(viaSong.audio80) });
        song.tempoScale = 2;
        song.play(SONG);
        song.refresh();
        for (let i = 0; i < 20; i++) {
            viaMusic.controls.update(TICK_MS);
            viaSong.controls.update(TICK_MS);
            song.update(TICK_MS);
            song.refresh();
        }
        expect(describeNoteOns(viaMusic.audio80.log)).toEqual(describeNoteOns(viaSong.audio80.log));
    });

    it('reports where its slot says the song heard has got to', () => {
        const { slot } = createSlotStandIn();
        const music = createMusicPlayer({ audio80: createChipOn(slot) });
        music.play(SONG);
        slot.song = SONG;
        slot.orderIndex = 1;
        slot.row = 3;
        slot.beat = 4.5;
        expect([music.song, music.orderIndex, music.row, music.beat]).toEqual([SONG, 1, 3, 4.5]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NoteOn = Extract<Audio80Write, { readonly kind: 'note-on' }>;

function describeNoteOns(log: readonly Audio80Write[]): string[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on').map((write) => `${write.voice}:${write.note}@${write.time.toFixed(3)}`);
}

/** A slot whose place a test sets, which notes each call made to it. */
function createSlotStandIn() {
    const calls: string[] = [];
    const slot: { -readonly [K in keyof SongSlot<Audio80Song>]: SongSlot<Audio80Song>[K] } = {
        song: undefined,
        orderIndex: 0,
        row: 0,
        beat: 0,
        play: () => calls.push('play'),
        queue: () => calls.push('queue'),
        stop: () => calls.push('stop'),
        setTempoScale: (scale) => calls.push(`tempo ${scale}`),
    };
    return { slot, calls };
}

/** A headless Audio80 whose sequencer opens `slot`. */
function createChipOn(slot: SongSlot<Audio80Song>): Audio80 {
    const { audio80 } = createHeadlessAudio80();
    return { ...audio80, openSongSlot: () => slot };
}

const SONG = createAudio80Song({
    bpm: 120,
    instruments: { s: createAudio80Sound({ wave: 'saw' }) },
    patterns: { a: '| C-4 s\n| E-4 s\n| G-4 s\n| C-5 s', b: '| D-4 s\n| F-4 s' },
    order: ['a', 'b'],
    loop: 0,
});
const OTHER_SONG = createAudio80Song({ bpm: 90, instruments: { s: createAudio80Sound({ wave: 'pulse' }) }, patterns: { a: '| A-3 s' }, order: ['a'] });

/**
 * A headless chip as its songs write to it. A headless chip is its own
 * writer, which its songs write their notes through, so the cast only names
 * what it already is.
 */
function asWriter<C extends Audio80>(chip: C): C & Audio80Writer {
    return chip as C & Audio80Writer;
}
