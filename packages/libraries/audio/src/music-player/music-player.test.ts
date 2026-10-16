import { describe, expect, it } from 'vitest';
import type { AudioControls } from '../chip';
import { toCutoff, toNoteNumber } from '../core';
import { type ChipWrite, createHeadlessAudio80 } from '../headless';
import { createInstrument, createSong, computeSongDurationMs, type Song, type SongOptions } from '../notation';
import { createMusicPlayer, type MusicPlayer } from './music-player';

const BPM = 150;
const ROWS_PER_BEAT = 4;
const ROW_MS = 60000 / (BPM * ROWS_PER_BEAT);
const LEAD = createInstrument({ wave: 'pulse', filter: 'a' });
const BASS = createInstrument({ wave: 'saw' });
const DRUM = createInstrument({ wave: 'noise', note: 'C-3' });

const TUNE = createSong({
    bpm: BPM,
    rowsPerBeat: ROWS_PER_BEAT,
    instruments: { L: LEAD, B: BASS, k: DRUM },
    patterns: {
        a: `
            | C-5 L v8  | C-3 B     | k
            | ...       | ...       | ...
            | E-5       | ===       | k
            | ===       | G-2 B     | ...
        `,
    },
    order: ['a', 'a+2'],
});

describe('music player', () => {
    it('stamps every note at the same chip time, whatever the length of the ticks', () => {
        const sixty = listNoteStamps(TUNE, () => 1000 / 60);
        const oneFortyFour = listNoteStamps(TUNE, () => 1000 / 144);
        let state = 3;
        const ragged = listNoteStamps(TUNE, () => {
            state = (state * 7 + 5) % 23;
            return 4 + state;
        });
        expect(sixty.length).toBeGreaterThan(0);
        expectClose(oneFortyFour, sixty);
        expectClose(ragged, sixty);
    });

    it('plays each row at its time, from the moment it is started', () => {
        const stamps = listNoteStamps(TUNE, () => 1000 / 60);
        // Row 0 starts all three channels. Row 2 starts channels 0 and 2, and row 3 starts channel 1
        expect(stamps.slice(0, 3)).toEqual([0, 0, 0]);
        expect(stamps).toContain(2 * ROW_MS);
        expect(stamps).toContain(3 * ROW_MS);
        expect(stamps).toContain(4 * ROW_MS);
    });

    it('times rows the same whether it is played before the update or in the refresh', () => {
        const beforeUpdate = listStampsWhenPlayed('before-update');
        const inRefresh = listStampsWhenPlayed('in-refresh');
        expect(beforeUpdate.length).toBeGreaterThan(0);
        expectClose(beforeUpdate, inRefresh);
        // Row 2 has a note on one channel. It plays two rows after the start, not a tick early
        expect(beforeUpdate.some((time) => Math.abs(time - (beforeUpdate[0] + 2 * ROW_MS)) < 1e-9)).toBe(true);
    });

    it('transposes written notes, and leaves an instrument\'s own note alone', () => {
        const { log } = playThrough(TUNE, () => 1000 / 60, computeSongDurationMs(TUNE) + 100);
        const notes = listNoteOns(log);
        const secondPass = notes.filter((write) => write.time >= 4 * ROW_MS);
        expect(secondPass.find((write) => write.voice === 0)?.note).toBe(requireNoteNumber('C-5') + TUNE.order[1].transpose);
        expect(secondPass.find((write) => write.voice === 2)?.note).toBe(DRUM.note);
    });

    it('releases on ===, and gives its voices back at the end', () => {
        const { log, player } = playThrough(TUNE, () => 1000 / 60, computeSongDurationMs(TUNE) + 100);
        expect(log.some((write) => write.kind === 'note-off' && write.voice === 1 && write.time === 2 * ROW_MS)).toBe(true);
        const reserves = log.filter((write) => write.kind === 'reserve-voices');
        expect(reserves[0]).toMatchObject({ count: TUNE.channelCount, time: 0 });
        expect(reserves[reserves.length - 1]).toMatchObject({ count: 0, time: computeSongDurationMs(TUNE) });
        expect(player.isPlaying).toBe(false);
    });

    it('sends each cell\'s effects to the chip with its note', () => {
        const song = createSong({ ...ONE_CHANNEL, patterns: { p: '| C-4 L a37 ~46 p8 fA' } });
        const { log } = playThrough(song, () => 10, ROW_MS / 2);
        expect(listSettingValues(log, 'arpeggio')).toEqual([0x37]);
        expect(listSettingValues(log, 'vibratoDepth')).toEqual([4 / 8]);
        expect(listSettingValues(log, 'vibratoRate')).toEqual([6]);
        expect(listSettingValues(log, 'pulseWidth')).toEqual([8 / 16]);
        const cutoffs = log.filter((write) => write.kind === 'set-filter' && write.setting === 'cutoffHz');
        expect(cutoffs).toEqual([expect.objectContaining({ filter: LEAD.filter, value: toCutoff(0xA), time: 0 })]);
    });

    it('goes back to its loop point at the end', () => {
        const looped = createSong({ ...TUNE_OPTIONS, order: ['a', 'b'], loop: 1 });
        const { log, player } = playThrough(looped, () => 1000 / 60, 3 * 4 * ROW_MS + 1);
        expect(player.isPlaying).toBe(true);
        // Pattern b's first note plays three times: once in order, then twice more around the loop
        expect(listNoteOns(log).filter((write) => write.note === requireNoteNumber('G-5')).map((write) => write.time)).toEqual([4 * ROW_MS, 8 * ROW_MS, 12 * ROW_MS]);
    });

    it('plays a queued song as the one playing ends, without a gap', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        player.queue(createSong({ ...TUNE_OPTIONS, order: ['b'] }));
        tick(controls, player, () => 1000 / 60, computeSongDurationMs(TUNE) + 3 * ROW_MS);
        const firstOfNext = listNoteOns(chip.log).find((write) => write.note === requireNoteNumber('G-5'));
        expect(firstOfNext?.time).toBeCloseTo(computeSongDurationMs(TUNE), 9);
    });

    it('plays a queued song instead of going back to its loop point', () => {
        const looped = createSong({ ...TUNE_OPTIONS, order: ['a'], loop: 0 });
        const next = createSong({ ...TUNE_OPTIONS, order: ['b'] });
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(looped);
        tick(controls, player, () => 1000 / 60, ROW_MS);
        player.queue(next);
        tick(controls, player, () => 1000 / 60, computeSongDurationMs(looped) + ROW_MS);
        const notes = listNoteOns(chip.log);
        expect(notes.filter((write) => write.note === requireNoteNumber('C-5')).map((write) => write.time)).toEqual([0]);
        expect(notes.find((write) => write.note === requireNoteNumber('G-5'))?.time).toBeCloseTo(computeSongDurationMs(looped), 9);
        expect(player.song).toBe(next);
    });

    it('cancels a queued song when told to play another', () => {
        const queued = createSong({ ...TUNE_OPTIONS, order: ['b'] });
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        player.queue(queued);
        tick(controls, player, () => 1000 / 60, ROW_MS);
        player.play(TUNE);
        tick(controls, player, () => 1000 / 60, computeSongDurationMs(TUNE) + 3 * ROW_MS);
        expect(listNoteOns(chip.log).some((write) => write.note === requireNoteNumber('G-5'))).toBe(false);
        expect(player.isPlaying).toBe(false);
    });

    it('releases the song playing when told to play another, and starts the new one at once', () => {
        const next = createSong({ ...TUNE_OPTIONS, order: ['b'] });
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        tick(controls, player, () => 10, ROW_MS * 1.5);
        const switchedAt = chip.time;
        chip.clear();
        player.play(next);
        player.refresh();
        const offs = chip.log.filter((write) => write.kind === 'note-off');
        expect(offs.map((write) => write.time)).toEqual(new Array<number>(TUNE.channelCount).fill(switchedAt));
        expect(listNoteOns(chip.log).find((write) => write.voice === 0)).toMatchObject({ note: requireNoteNumber('G-5'), time: switchedAt });
        expect(player.song).toBe(next);
        expect(player.beat).toBe(0);
    });

    it('plays faster by its tempo scale', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.tempoScale = 2;
        player.play(TUNE);
        tick(controls, player, () => 1000 / 60, computeSongDurationMs(TUNE));
        // Row 2, at double tempo
        expect(listNoteOns(chip.log).some((write) => Math.abs(write.time - ROW_MS) < 1e-9)).toBe(true);
        expect(player.isPlaying).toBe(false);
    });

    it('plays the rest of the song at a new tempo scale from the update after it changes', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        tick(controls, player, () => 10, 2 * ROW_MS);
        player.tempoScale = 2;
        tick(controls, player, () => 10, ROW_MS);
        // Row 3, which starts G-2 on channel 1, half a row after row 2
        const bass = listNoteOns(chip.log).find((write) => write.note === requireNoteNumber('G-2'));
        expect(bass?.time).toBeCloseTo(2 * ROW_MS + ROW_MS / 2, 9);
    });

    it('holds where it is at a tempo of 0, and carries on from there', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        tick(controls, player, () => 10, ROW_MS * 1.5);
        const before = listNoteOns(chip.log).length;
        const beat = player.beat;
        player.tempoScale = 0;
        tick(controls, player, () => 10, ROW_MS * 10);
        expect(listNoteOns(chip.log)).toHaveLength(before);
        expect(player.beat).toBe(beat);
        player.tempoScale = 1;
        tick(controls, player, () => 10, ROW_MS);
        expect(listNoteOns(chip.log).length).toBeGreaterThan(before);
    });

    it('holds at a tempo scale that is negative or not finite', () => {
        const player = createMusicPlayer({ audio80: createHeadlessAudio80({ record: true }).audio80 });
        for (const scale of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
            player.tempoScale = scale;
            expect(player.tempoScale, `${scale}`).toBe(0);
        }
    });

    it('ignores a deltaMs of 0 or less, or not finite', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(createSong({ ...TUNE_OPTIONS, order: ['a'], loop: 0 }));
        player.refresh();
        chip.clear();
        controls.update(ROW_MS);
        for (const deltaMs of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) player.update(deltaMs);
        player.refresh();
        expect(chip.log).toHaveLength(0);
        expect(player.beat).toBe(0);
    });

    it('slides by the written amount over the row, at any tempo scale', () => {
        const song = createSong({ ...ONE_CHANNEL, patterns: { p: SLIDE_THEN_HOLD } });
        const steady = playThrough(song, () => 10, 2 * ROW_MS).log;
        expect(measureSlide(steady, 0, 0, ROW_MS)).toBeCloseTo(SLIDE, 9);

        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(song);
        tick(controls, player, () => 10, ROW_MS / 2);
        player.tempoScale = 2;
        tick(controls, player, () => 10, ROW_MS);
        // Half the row plays at its own tempo, and the other half at double. So it ends a quarter of
        // a row early
        const rowEndMs = ROW_MS / 2 + ROW_MS / 4;
        expect(measureSlide(chip.log, 0, 0, rowEndMs)).toBeCloseTo(SLIDE, 9);
        expect(measureSlide(chip.log, 0, rowEndMs, chip.time)).toBe(0);
    });

    it('stops a slide while the song is held, and carries it on when it resumes', () => {
        const song = createSong({ ...ONE_CHANNEL, patterns: { p: SLIDE_THEN_HOLD } });
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(song);
        tick(controls, player, () => 10, ROW_MS / 2);
        const heldAt = chip.time;
        player.tempoScale = 0;
        tick(controls, player, () => 10, 5 * ROW_MS);
        expect(measureSlide(chip.log, 0, 0, heldAt)).toBeCloseTo(SLIDE / 2, 9);
        expect(measureSlide(chip.log, 0, heldAt, chip.time)).toBe(0);
        player.tempoScale = 1;
        tick(controls, player, () => 10, 2 * ROW_MS);
        expect(measureSlide(chip.log, 0, 0, chip.time)).toBeCloseTo(SLIDE, 9);
    });

    it('swings each odd row of a pattern late, the same on every pass', () => {
        const swing = 0.25;
        const p = `
            | C-4 L
            | D-4
            | E-4
        `;
        const rowCount = 3;
        const song = createSong({ ...ONE_CHANNEL, swing, patterns: { p }, order: ['p', 'p'] });
        const expected: number[] = [];
        for (let pass = 0; pass < 2; pass++) {
            for (let row = 0; row < rowCount; row++) expected.push((pass * rowCount + row + (row % 2 === 1 ? swing : 0)) * ROW_MS);
        }
        expectClose(listNoteStamps(song, () => 10), expected);
    });

    it('slides and glides over a swung row\'s actual length', () => {
        const swing = 0.25;
        const slid = `
            | C-4 L u0C
            | D-4 u0C
            | E-4 >
        `;
        const song = createSong({ ...ONE_CHANNEL, swing, patterns: { p: slid } });
        const { log } = playThrough(song, () => 10, computeSongDurationMs(song));
        const rowStarts = [0, (1 + swing) * ROW_MS, 2 * ROW_MS];
        expect(measureSlide(log, 0, rowStarts[0], rowStarts[1])).toBeCloseTo(SLIDE, 9);
        expect(measureSlide(log, 0, rowStarts[1], rowStarts[2])).toBeCloseTo(SLIDE, 9);
        // Row 2 is the last row. The row after it is row 0 of the next pass, which is on the beat
        expect(listSettingValues(log, 'glide')).toEqual([ROW_MS]);
        const glide = `
            | C-4 L
            | D-4 >
            | ...
        `;
        const glided = createSong({ ...ONE_CHANNEL, swing, patterns: { p: glide } });
        expect(listSettingValues(playThrough(glided, () => 10, computeSongDurationMs(glided)).log, 'glide')).toEqual([(1 - swing) * ROW_MS]);
    });

    it('carries on where it was after a pause, with no gap in its stamps', () => {
        const straight = listNoteStamps(TUNE, () => 1000 / 60);
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        const pausedAtMs = 100;
        const totalMs = computeSongDurationMs(TUNE) + 100;
        player.play(TUNE);
        tick(controls, player, () => 1000 / 60, pausedAtMs);
        // While paused, the game loop advances neither the chip nor the view, but still refreshes the view
        for (let i = 0; i < 30; i++) player.refresh();
        tick(controls, player, () => 1000 / 60, totalMs - pausedAtMs);
        expectClose(listNoteOns(chip.log).map((write) => write.time), straight);
    });

    it('releases its notes and its voices when stopped', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        tick(controls, player, () => 1000 / 60, 50);
        chip.clear();
        player.stop();
        player.refresh();
        expect(chip.log.filter((write) => write.kind === 'note-off')).toHaveLength(TUNE.channelCount);
        expect(chip.log[chip.log.length - 1]).toMatchObject({ kind: 'reserve-voices', count: 0 });
        expect(player.song).toBeUndefined();
    });

    it('counts beats from the start of the song', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        tick(controls, player, () => 10, ROW_MS * ROWS_PER_BEAT);
        expect(player.beat).toBeCloseTo(1, 9);
    });

    it('writes nothing in its update step, and everything in its refresh', () => {
        const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
        const player = createMusicPlayer({ audio80: chip });
        player.play(TUNE);
        controls.update(500);
        player.update(500);
        expect(chip.log).toHaveLength(0);
        player.refresh();
        expect(chip.log.length).toBeGreaterThan(0);
    });

    it('plays every note at its song\'s volume', () => {
        const volume = 0.5;
        const song = createSong({ ...TUNE_OPTIONS, order: ['a'] });
        const asWritten = listNoteOns(playThrough(song, () => 10, computeSongDurationMs(song)).log);
        const quieter = listNoteOns(playThrough(createSong({ ...TUNE_OPTIONS, order: ['a'], volume }), () => 10, computeSongDurationMs(song)).log);
        expect(quieter.map((write) => write.volume)).toEqual(asWritten.map((write) => write.volume * volume));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TUNE_OPTIONS = {
    bpm: BPM,
    rowsPerBeat: ROWS_PER_BEAT,
    instruments: { L: LEAD, B: BASS, k: DRUM },
    patterns: {
        a: `
            | C-5 L | C-3 B | k
            | ...   | ...   | ...
            | ...   | ...   | k
            | ...   | ...   | ...
        `,
        b: `
            | G-5 L | ...   | k
            | ...   | ...   | ...
            | ...   | ...   | k
            | ...   | ...   | ...
        `,
    },
};

/** A one-channel song, for tests that set their own patterns. */
const ONE_CHANNEL: SongOptions = { bpm: BPM, rowsPerBeat: ROWS_PER_BEAT, instruments: { L: LEAD }, patterns: { p: '| C-4 L' }, order: ['p'] };

/** The semitones a `u0C` slides by. */
const SLIDE = 0x0C;

/** A slide up an octave, then a row that holds the note. */
const SLIDE_THEN_HOLD = `
    | C-4 L u0C
    | ...
`;

type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;
type SetVoice = Extract<ChipWrite, { kind: 'set-voice'; value: number }>;

/** A note's number from its name, for notes the tests write. */
function requireNoteNumber(name: string): number {
    const number = toNoteNumber(name);
    if (number === undefined) throw new Error(`'${name}' is not a note`);
    return number;
}

function listNoteOns(log: readonly ChipWrite[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/** The values written to one voice setting, in order. */
function listSettingValues(log: readonly ChipWrite[], setting: SetVoice['setting']): number[] {
    return log.filter((write): write is SetVoice => write.kind === 'set-voice' && write.setting === setting).map((write) => write.value);
}

/**
 * How far `voice` slid between two chip times, in semitones, as the chip
 * would play the log. A slide write sets the rate in semitones a second, and
 * a `noteOn` stops the slide.
 */
function measureSlide(log: readonly ChipWrite[], voice: number, fromMs: number, toMs: number): number {
    let rate = 0;
    let at = fromMs;
    let total = 0;
    for (const write of log) {
        const isSlide = write.kind === 'set-voice' && write.setting === 'slide';
        if ((!isSlide && write.kind !== 'note-on') || !('voice' in write) || write.voice !== voice) continue;
        if (write.time >= toMs) break;
        if (write.time > at) {
            total += rate * (write.time - at) / 1000;
            at = write.time;
        }
        rate = write.kind === 'set-voice' && write.setting === 'slide' ? write.value : 0;
    }
    return total + rate * (toMs - at) / 1000;
}

function listNoteStamps(song: Song, tickMs: () => number): number[] {
    return listNoteOns(playThrough(song, tickMs, computeSongDurationMs(song) + 100).log).map((write) => write.time);
}

/** The note stamps of TUNE when it starts at the same chip time, either before the update or in the refresh. */
function listStampsWhenPlayed(when: 'before-update' | 'in-refresh'): number[] {
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    const tickMs = 1000 / 60;
    const startTick = 3;
    const totalMs = computeSongDurationMs(TUNE) + 100;
    for (let i = 0; i * tickMs < totalMs; i++) {
        controls.update(tickMs);
        if (i === startTick && when === 'before-update') player.play(TUNE);
        player.update(tickMs);
        if (i === startTick && when === 'in-refresh') player.play(TUNE);
        player.refresh();
    }
    return listNoteOns(chip.log).map((write) => write.time);
}

function playThrough(song: Song, tickMs: () => number, durationMs: number) {
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    player.play(song);
    tick(controls, player, tickMs, durationMs);
    return { log: chip.log, player };
}

/** Ticks as a game loop does: the chip's clock, then the view's update, then its refresh. */
function tick(controls: AudioControls, player: MusicPlayer, tickMs: () => number, durationMs: number): void {
    let elapsed = 0;
    player.refresh();
    while (elapsed < durationMs) {
        const delta = tickMs();
        elapsed += delta;
        controls.update(delta);
        player.update(delta);
        player.refresh();
    }
}

function expectClose(actual: readonly number[], expected: readonly number[]): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i]).toBeCloseTo(expected[i], 6);
}
