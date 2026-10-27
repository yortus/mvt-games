import { describe, expect, expectTypeOf, it } from 'vitest';
import { createAudio80Sound, createAudio80Song } from '../audio80';
import { type Audio90, type Audio90Song, type Audio90Writer, createAudio90Sound, createAudio90Song } from '../audio90';
import { type Audio90Write, createHeadlessAudio90, measurePeak, renderSong } from '../headless';
import { type HeadlessControls, computeSongDurationMs } from '../shared';
import { createSongPlayer, type SongPlayer } from './song-player';

const BPM = 150;
const ROW_MS = 60000 / (BPM * 4);
const SAW = createAudio90Sound({ oscillator: { wave: 'saw' } });
const KICK = createAudio90Sound({ engine: 'fm', operators: [{}], note: 'C-2', envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 10 } });

const GROOVE = createAudio90Song({
    bpm: BPM,
    instruments: { S: SAW, k: KICK },
    patterns: {
        a: `
            | A-3 S P40 | k
            | ...       | ...
            | C-4 c47   | k
            | ===       | ...
        `,
    },
    order: ['a', 'a+2'],
    mixer: [{ pan: -0.5 }],
    pump: { channel: 1 },
});

describe('song player, on an Audio90', () => {
    it('writes the song\'s settings, then each row at its chip time, and nothing until it refreshes', () => {
        const { audio90: chip, controls } = createHeadlessAudio90({ record: true });
        const player = createSongPlayer({ audio90: asWriter(chip) });
        player.play(GROOVE);
        controls.update(ROW_MS * 2.5);
        player.update(ROW_MS * 2.5);
        expect(chip.log).toEqual([]);
        player.refresh();
        expect(chip.log[0]).toEqual({ kind: 'reserve-voices', count: 2, time: 0 });
        expect(chip.log).toContainEqual({ kind: 'set-tempo', bpm: BPM, time: 0 });
        expect(chip.log).toContainEqual({ kind: 'set-effect', effect: 'pump', setting: 'voice', value: 1, time: 0 });
        expect(chip.log).toContainEqual({ kind: 'set-voice', voice: 0, setting: 'pan', value: -0.5, time: 0 });
        expect(listNoteOns(chip.log).map((write) => [write.voice, write.note, write.time])).toEqual([[0, 57, 0], [1, 36, 0], [0, 60, 2 * ROW_MS], [1, 36, 2 * ROW_MS]]);
        expect(chip.log).toContainEqual({ kind: 'set-voice', voice: 0, setting: 'chord', value: 0x47, time: 2 * ROW_MS });
    });

    it('stamps every note at the same chip time, whatever the length of the ticks', () => {
        const sixty = listNoteStamps(() => 1000 / 60);
        let state = 3;
        const ragged = listNoteStamps(() => {
            state = (state * 7 + 5) % 23;
            return 4 + state;
        });
        expect(sixty.length).toBe(8);
        expect(ragged).toHaveLength(sixty.length);
        for (let i = 0; i < sixty.length; i++) expect(ragged[i]).toBeCloseTo(sixty[i], 6);
    });

    it('tells the chip the tempo its scale makes, and 0 while it holds the song still', () => {
        const { audio90: chip, controls } = createHeadlessAudio90({ record: true });
        const player = createSongPlayer({ audio90: asWriter(chip) });
        player.play(GROOVE);
        tick(controls, player, ROW_MS, ROW_MS);
        player.tempoScale = 0.5;
        tick(controls, player, ROW_MS, ROW_MS);
        player.tempoScale = 0;
        chip.clear();
        tick(controls, player, ROW_MS, 10 * ROW_MS);
        expect(chip.log).toEqual([{ kind: 'set-tempo', bpm: 0, time: 2 * ROW_MS }]);
        player.tempoScale = 1;
        tick(controls, player, ROW_MS, ROW_MS);
        expect(chip.log).toContainEqual({ kind: 'set-tempo', bpm: BPM, time: 12 * ROW_MS });
    });

    it('plays a queued song at the end of the first, and gives the voices back when it stops', () => {
        const { audio90: chip, controls } = createHeadlessAudio90({ record: true });
        const player = createSongPlayer({ audio90: asWriter(chip) });
        const next = createAudio90Song({ bpm: 120, instruments: { S: SAW }, patterns: { p: '| C-5 S' }, order: ['p'] });
        player.play(GROOVE);
        player.queue(next);
        tick(controls, player, 1000 / 60, computeSongDurationMs(GROOVE) + 50);
        expect(player.song).toBe(next);
        expect(chip.log).toContainEqual({ kind: 'reserve-voices', count: 1, time: computeSongDurationMs(GROOVE) });
        player.stop();
        player.refresh();
        expect(chip.log.at(-1)).toMatchObject({ kind: 'reserve-voices', count: 0 });
        expect(player.isPlaying).toBe(false);
    });

    it('renders a song in stereo, where the mixer puts each channel', () => {
        const left = createAudio90Song({ bpm: 120, instruments: { S: SAW }, patterns: { p: '| A-3 S\n| ...' }, order: ['p'], mixer: [{ pan: -1 }] });
        const rendered = renderSong(left, { durationMs: 300 });
        expect(measurePeak(rendered.left)).toBeGreaterThan(0.05);
        expect(measurePeak(rendered.right)).toBeLessThan(1e-6);
    });

    it('takes, in its type, only songs of the chip it plays on', () => {
        const player = createSongPlayer({ audio90: asWriter(createHeadlessAudio90().audio90) });
        expectTypeOf(player).toEqualTypeOf<SongPlayer<Audio90Song>>();
        const audio80Song = createAudio80Song({ bpm: 120, instruments: { L: createAudio80Sound({}) }, patterns: { p: '| C-4 L' }, order: ['p'] });
        // Never called: it is here to be type checked
        const playWrongSong = (): void => {
            // @ts-expect-error An Audio90's player plays only Audio90 songs
            player.play(audio80Song);
        };
        expect(playWrongSong).toBeTypeOf('function');
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** GROOVE's note stamps, played once through with ticks of `tickMs`. */
function listNoteStamps(tickMs: () => number): number[] {
    const { audio90: chip, controls } = createHeadlessAudio90({ record: true });
    const player = createSongPlayer({ audio90: asWriter(chip) });
    player.play(GROOVE);
    tick(controls, player, tickMs, computeSongDurationMs(GROOVE) - 1);
    return listNoteOns(chip.log).map((write) => write.time);
}

/** Ticks as a game loop does, for `durationMs`: the chip's clock, then the view's update, then its refresh. */
function tick(controls: HeadlessControls, player: SongPlayer<Audio90Song>, tickMs: number | (() => number), durationMs: number): void {
    let elapsed = 0;
    while (elapsed < durationMs - 1e-9) {
        const delta = typeof tickMs === 'number' ? tickMs : tickMs();
        elapsed += delta;
        controls.update(delta);
        player.update(delta);
        player.refresh();
    }
}

function listNoteOns(log: readonly Audio90Write[]): Extract<Audio90Write, { kind: 'note-on' }>[] {
    return log.filter((write): write is Extract<Audio90Write, { kind: 'note-on' }> => write.kind === 'note-on');
}

/**
 * A headless chip as its songs write to it. A headless chip is its own
 * writer, which its songs write their notes through, so the cast only names
 * what it already is.
 */
function asWriter<C extends Audio90>(chip: C): C & Audio90Writer {
    return chip as C & Audio90Writer;
}
