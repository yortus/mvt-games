import { describe, expect, it } from 'vitest';
import { type Audio80Writer, createAudio80Sound, createAudio80Song } from '../audio80';
import { createSongPlayer } from '../song-player';
import { type Audio80Write, createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';

const TICK_MS = 16;

describe('a headless chip\'s songs', () => {
    it('play the same notes, at the same times, as a song player on the same chip', () => {
        const viaChip = createHeadlessAudio80({ record: true });
        viaChip.play(SONG);
        const viaPlayer = createHeadlessAudio80({ record: true });
        const player = createSongPlayer({ audio80: asWriter(viaPlayer) });
        player.play(SONG);
        player.refresh();
        for (let i = 0; i < 40; i++) {
            viaChip.update(TICK_MS);
            viaPlayer.update(TICK_MS);
            player.update(TICK_MS);
            player.refresh();
        }
        expect(describeNoteOns(viaChip.log)).toEqual(describeNoteOns(viaPlayer.log));
        expect(describeNoteOns(viaChip.log).length).toBeGreaterThan(4);
    });

    it('answer with the song asked for at once, and from its start', () => {
        const chip = createHeadlessAudio80();
        chip.play(SONG);
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect(chip.row).toBeGreaterThan(0);
        chip.play(OTHER_SONG);
        expect([chip.song, chip.orderIndex, chip.row, chip.beat]).toEqual([OTHER_SONG, 0, 0, 0]);
        chip.stop();
        expect(chip.song).toBeUndefined();
    });

    it('start at the tempo set just after the song, as a song player does with the tempo set first', () => {
        const viaChip = createHeadlessAudio80({ record: true });
        viaChip.play(SONG);
        viaChip.tempoScale = 2;
        const viaPlayer = createHeadlessAudio80({ record: true });
        const player = createSongPlayer({ audio80: asWriter(viaPlayer) });
        player.tempoScale = 2;
        player.play(SONG);
        player.refresh();
        for (let i = 0; i < 20; i++) {
            viaChip.update(TICK_MS);
            viaPlayer.update(TICK_MS);
            player.update(TICK_MS);
            player.refresh();
        }
        expect(describeNoteOns(viaChip.log)).toEqual(describeNoteOns(viaPlayer.log));
    });

    it('stand still while the chip is paused', () => {
        const chip = createHeadlessAudio80();
        chip.play(SONG);
        chip.update(TICK_MS);
        chip.pause();
        const time = chip.time;
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect([chip.time, chip.row]).toEqual([time, 0]);
        chip.resume();
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect(chip.row).toBeGreaterThan(0);
    });
});

describe('a headless chip\'s stop', () => {
    it('releases the song\'s notes and its own, with no id', () => {
        const chip = createHeadlessAudio80({ record: true });
        chip.play(SONG);
        chip.update(TICK_MS);
        chip.clear();
        chip.stop();
        expect(chip.song).toBeUndefined();
        // The song releases its note
        expect(chip.log.map((write) => write.kind)).toEqual(['stop', 'note-off']);
    });

    it('stops the song, and leaves the sounds playing, with the song\'s id', () => {
        const chip = createHeadlessAudio80({ record: true });
        const song = chip.play(SONG);
        const zap = chip.play(ZAP);
        chip.clear();
        chip.stop(song);
        expect(chip.song).toBeUndefined();
        expect(zap).not.toBe(song);
        // The song releases its note
        expect(chip.log.map((write) => write.kind)).toEqual(['stop', 'note-off']);
    });

    it('cuts every voice at once while the chip is paused, so nothing plays on as it resumes', () => {
        const chip = createHeadlessAudio80({ render: true });
        chip.play(ZAP, { lengthMs: Infinity });
        chip.update(TICK_MS);
        chip.renderInto(new Float32Array(768));
        chip.pause();
        chip.stop();
        chip.resume();
        chip.update(TICK_MS);
        const after = new Float32Array(768);
        chip.renderInto(after);
        expect(Math.max(...after.map(Math.abs))).toBe(0);
    });

    it('lets each voice fade out as its envelope says while the chip plays', () => {
        const chip = createHeadlessAudio80({ render: true });
        chip.play(ZAP, { lengthMs: Infinity });
        chip.update(TICK_MS);
        chip.renderInto(new Float32Array(768));
        chip.stop();
        chip.update(TICK_MS);
        const after = new Float32Array(768);
        chip.renderInto(after);
        expect(Math.max(...after.map(Math.abs))).toBeGreaterThan(0.01);
    });
});

describe('a headless chip made without render', () => {
    it('refuses to render, since it has nothing to render', () => {
        expect(() => createHeadlessAudio80().renderInto(new Float32Array(16))).toThrow('made without `render`');
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NoteOn = Extract<Audio80Write, { readonly kind: 'note-on' }>;

function describeNoteOns(log: readonly Audio80Write[]): string[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on').map((write) => `${write.voice}:${write.note}@${write.time.toFixed(3)}`);
}

const SONG = createAudio80Song({
    bpm: 120,
    instruments: { s: createAudio80Sound({ wave: 'saw' }) },
    patterns: { a: '| C-4 s\n| E-4 s\n| G-4 s\n| C-5 s', b: '| D-4 s\n| F-4 s' },
    order: ['a', 'b'],
    loop: 0,
});
const OTHER_SONG = createAudio80Song({ bpm: 90, instruments: { s: createAudio80Sound({ wave: 'pulse' }) }, patterns: { a: '| A-3 s' }, order: ['a'] });
/** A sound with a slow release, so a release is still heard a tick later, and a cut is not. */
const ZAP = createAudio80Sound({ wave: 'saw', note: 'A-4', envelope: { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 500 } });

/**
 * A headless chip as its songs write to it. A headless chip is its own
 * writer, which its songs write their notes through, so the cast only names
 * what it already is.
 */
function asWriter(chip: HeadlessAudio80): HeadlessAudio80 & Audio80Writer {
    return chip as HeadlessAudio80 & Audio80Writer;
}
