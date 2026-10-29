import { describe, expect, it, vi } from 'vitest';
import {
    createAudio80Song,
    createAudio80SongDriver,
    createAudio80Sound,
    FILTER_SETTING_INDEX,
    OP_SET_ECHO,
    OP_SET_FILTER,
    toCutoff,
    VOICE_SETTING_INDEX,
    type Audio80Song,
    type Audio80SongOptions,
    type Audio80Sound,
} from '../audio80';
import { OP_NOTE_OFF, OP_NOTE_ON, OP_SET_VOICE } from './commands';
import { toNoteNumber } from './notes';
import { createSongPlayer, type SongPlayer, type SongWriter } from './song-player';

const BPM = 150;
const ROWS_PER_BEAT = 4;
const ROW_MS = 60000 / (BPM * ROWS_PER_BEAT);
const LEAD = createAudio80Sound({ wave: 'pulse', filter: 'a' });
const BASS = createAudio80Sound({ wave: 'saw' });
const DRUM = createAudio80Sound({ wave: 'noise', note: 'C-3' });

const TUNE = createAudio80Song({
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

describe('song player', () => {
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

    it('times rows the same whether it is played before or after the update in a tick', () => {
        const beforeUpdate = listStampsWhenPlayed('before-update');
        const afterUpdate = listStampsWhenPlayed('after-update');
        expect(beforeUpdate.length).toBeGreaterThan(0);
        expectClose(beforeUpdate, afterUpdate);
        // Row 2 has a note on one channel. It plays two rows after the start, not a tick early
        expect(beforeUpdate.some((time) => Math.abs(time - (beforeUpdate[0] + 2 * ROW_MS)) < 1e-9)).toBe(true);
    });

    it('transposes written notes, and leaves an instrument\'s own note alone', () => {
        const { log } = playThrough(TUNE, () => 1000 / 60, TUNE.durationMs + 100);
        const notes = listNoteOns(log);
        const secondPass = notes.filter((write) => write.time >= 4 * ROW_MS);
        expect(secondPass.find((write) => write.voice === 0)?.note).toBe(requireNoteNumber('C-5') + TUNE.order[1].transpose);
        expect(secondPass.find((write) => write.voice === 2)?.note).toBe(DRUM.note);
    });

    it('releases on ===, and stops at the end', () => {
        const { log, player } = playThrough(TUNE, () => 1000 / 60, TUNE.durationMs + 100);
        expect(log.some((write) => write.kind === 'note-off' && write.voice === 1 && write.time === 2 * ROW_MS)).toBe(true);
        expect(player.song !== undefined).toBe(false);
    });

    it('sends each cell\'s effects to the chip with its note', () => {
        const song = createAudio80Song({ ...ONE_CHANNEL, patterns: { p: '| C-4 L a37 ~46 p8 fA' } });
        const { log } = playThrough(song, () => 10, ROW_MS / 2);
        expect(listSettingValues(log, VOICE_SETTING_INDEX.arpeggio)).toEqual([0x37]);
        expect(listSettingValues(log, VOICE_SETTING_INDEX.vibratoDepth)).toEqual([4 / 8]);
        expect(listSettingValues(log, VOICE_SETTING_INDEX.vibratoRate)).toEqual([6]);
        expect(listSettingValues(log, VOICE_SETTING_INDEX.pulseWidth)).toEqual([8 / 16]);
        const cutoffs = log.filter((write) => write.kind === 'set-filter' && write.setting === FILTER_SETTING_INDEX.cutoffHz);
        expect(cutoffs).toEqual([expect.objectContaining({ filter: 0, value: toCutoff(0xA), time: 0 })]);
    });

    it('goes back to its loop point at the end', () => {
        const looped = createAudio80Song({ ...TUNE_OPTIONS, order: ['a', 'b'], loop: 1 });
        const { log, player } = playThrough(looped, () => 1000 / 60, 3 * 4 * ROW_MS + 1);
        expect(player.song !== undefined).toBe(true);
        // Pattern b's first note plays three times: once in order, then twice more around the loop
        expect(listNoteOns(log).filter((write) => write.note === requireNoteNumber('G-5')).map((write) => write.time)).toEqual([4 * ROW_MS, 8 * ROW_MS, 12 * ROW_MS]);
    });

    it('plays a queued song as the one playing ends, without a gap', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        player.queue(createAudio80Song({ ...TUNE_OPTIONS, order: ['b'] }));
        tick(chip, player, () => 1000 / 60, TUNE.durationMs + 3 * ROW_MS);
        const firstOfNext = listNoteOns(chip.log).find((write) => write.note === requireNoteNumber('G-5'));
        expect(firstOfNext?.time).toBeCloseTo(TUNE.durationMs, 9);
    });

    it('plays a queued song instead of going back to its loop point', () => {
        const looped = createAudio80Song({ ...TUNE_OPTIONS, order: ['a'], loop: 0 });
        const next = createAudio80Song({ ...TUNE_OPTIONS, order: ['b'] });
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(looped);
        tick(chip, player, () => 1000 / 60, ROW_MS);
        player.queue(next);
        tick(chip, player, () => 1000 / 60, looped.durationMs + ROW_MS);
        const notes = listNoteOns(chip.log);
        expect(notes.filter((write) => write.note === requireNoteNumber('C-5')).map((write) => write.time)).toEqual([0]);
        expect(notes.find((write) => write.note === requireNoteNumber('G-5'))?.time).toBeCloseTo(looped.durationMs, 9);
        expect(player.song).toBe(next);
    });

    it('cancels a queued song when told to play another', () => {
        const queued = createAudio80Song({ ...TUNE_OPTIONS, order: ['b'] });
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        player.queue(queued);
        tick(chip, player, () => 1000 / 60, ROW_MS);
        player.play(TUNE);
        tick(chip, player, () => 1000 / 60, TUNE.durationMs + 3 * ROW_MS);
        expect(listNoteOns(chip.log).some((write) => write.note === requireNoteNumber('G-5'))).toBe(false);
        expect(player.song !== undefined).toBe(false);
    });

    it('releases the song playing when told to play another, and starts the new one at once', () => {
        const next = createAudio80Song({ ...TUNE_OPTIONS, order: ['b'] });
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        tick(chip, player, () => 10, ROW_MS * 1.5);
        const switchedAt = chip.writer.time;
        chip.clear();
        player.play(next);
        const offs = chip.log.filter((write) => write.kind === 'note-off');
        expect(offs.map((write) => write.time)).toEqual(new Array<number>(TUNE.channelCount).fill(switchedAt));
        expect(listNoteOns(chip.log).find((write) => write.voice === 0)).toMatchObject({ note: requireNoteNumber('G-5'), time: switchedAt });
        expect(player.song).toBe(next);
        expect(player.beat).toBe(0);
    });

    it('plays faster by its tempo scale', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.tempoScale = 2;
        player.play(TUNE);
        tick(chip, player, () => 1000 / 60, TUNE.durationMs);
        // Row 2, at double tempo
        expect(listNoteOns(chip.log).some((write) => Math.abs(write.time - ROW_MS) < 1e-9)).toBe(true);
        expect(player.song !== undefined).toBe(false);
    });

    it('plays the rest of the song at a new tempo scale from the update after it changes', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        tick(chip, player, () => 10, 2 * ROW_MS);
        player.tempoScale = 2;
        tick(chip, player, () => 10, ROW_MS);
        // Row 3, which starts G-2 on channel 1, half a row after row 2
        const bass = listNoteOns(chip.log).find((write) => write.note === requireNoteNumber('G-2'));
        expect(bass?.time).toBeCloseTo(2 * ROW_MS + ROW_MS / 2, 9);
    });

    it('holds where it is at a tempo of 0, and carries on from there', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        tick(chip, player, () => 10, ROW_MS * 1.5);
        const before = listNoteOns(chip.log).length;
        const beat = player.beat;
        player.tempoScale = 0;
        tick(chip, player, () => 10, ROW_MS * 10);
        expect(listNoteOns(chip.log)).toHaveLength(before);
        expect(player.beat).toBe(beat);
        player.tempoScale = 1;
        tick(chip, player, () => 10, ROW_MS);
        expect(listNoteOns(chip.log).length).toBeGreaterThan(before);
    });

    it('holds at a tempo scale that is negative or not finite', () => {
        const player = createSongPlayer(createAudio80SongDriver(createTestWriter().writer));
        for (const scale of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
            player.tempoScale = scale;
            expect(player.tempoScale, `${scale}`).toBe(0);
        }
    });

    it('ignores a deltaMs of 0 or less, or not finite', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(createAudio80Song({ ...TUNE_OPTIONS, order: ['a'], loop: 0 }));
        chip.clear();
        chip.update(ROW_MS);
        for (const deltaMs of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) player.update(deltaMs);
        expect(chip.log).toHaveLength(0);
        expect(player.beat).toBe(0);
    });

    it('slides by the written amount over the row, at any tempo scale', () => {
        const song = createAudio80Song({ ...ONE_CHANNEL, patterns: { p: SLIDE_THEN_HOLD } });
        const steady = playThrough(song, () => 10, 2 * ROW_MS).log;
        expect(measureSlide(steady, 0, 0, ROW_MS)).toBeCloseTo(SLIDE, 9);

        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(song);
        tick(chip, player, () => 10, ROW_MS / 2);
        player.tempoScale = 2;
        tick(chip, player, () => 10, ROW_MS);
        // Half the row plays at its own tempo, and the other half at double. So it ends a quarter of
        // a row early
        const rowEndMs = ROW_MS / 2 + ROW_MS / 4;
        expect(measureSlide(chip.log, 0, 0, rowEndMs)).toBeCloseTo(SLIDE, 9);
        expect(measureSlide(chip.log, 0, rowEndMs, chip.writer.time)).toBe(0);
    });

    it('stops a slide while the song is held, and carries it on when it resumes', () => {
        const song = createAudio80Song({ ...ONE_CHANNEL, patterns: { p: SLIDE_THEN_HOLD } });
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(song);
        tick(chip, player, () => 10, ROW_MS / 2);
        const heldAt = chip.writer.time;
        player.tempoScale = 0;
        tick(chip, player, () => 10, 5 * ROW_MS);
        expect(measureSlide(chip.log, 0, 0, heldAt)).toBeCloseTo(SLIDE / 2, 9);
        expect(measureSlide(chip.log, 0, heldAt, chip.writer.time)).toBe(0);
        player.tempoScale = 1;
        tick(chip, player, () => 10, 2 * ROW_MS);
        expect(measureSlide(chip.log, 0, 0, chip.writer.time)).toBeCloseTo(SLIDE, 9);
    });

    it('swings each odd row of a pattern late, the same on every pass', () => {
        const swing = 0.25;
        const p = `
            | C-4 L
            | D-4
            | E-4
        `;
        const rowCount = 3;
        const song = createAudio80Song({ ...ONE_CHANNEL, swing, patterns: { p }, order: ['p', 'p'] });
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
        const song = createAudio80Song({ ...ONE_CHANNEL, swing, patterns: { p: slid } });
        const { log } = playThrough(song, () => 10, song.durationMs);
        const rowStarts = [0, (1 + swing) * ROW_MS, 2 * ROW_MS];
        expect(measureSlide(log, 0, rowStarts[0], rowStarts[1])).toBeCloseTo(SLIDE, 9);
        expect(measureSlide(log, 0, rowStarts[1], rowStarts[2])).toBeCloseTo(SLIDE, 9);
        // Row 2 is the last row. The row after it is row 0 of the next pass, which is on the beat
        expect(listSettingValues(log, VOICE_SETTING_INDEX.glide)).toEqual([ROW_MS]);
        const glide = `
            | C-4 L
            | D-4 >
            | ...
        `;
        const glided = createAudio80Song({ ...ONE_CHANNEL, swing, patterns: { p: glide } });
        expect(listSettingValues(playThrough(glided, () => 10, glided.durationMs).log, VOICE_SETTING_INDEX.glide)).toEqual([(1 - swing) * ROW_MS]);
    });

    it('releases its notes and its voices when stopped', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        tick(chip, player, () => 1000 / 60, 50);
        chip.clear();
        player.stop();
        expect(chip.log.filter((write) => write.kind === 'note-off')).toHaveLength(TUNE.channelCount);
        expect(player.song).toBeUndefined();
    });

    it('counts beats from the start of the song', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(TUNE);
        tick(chip, player, () => 10, ROW_MS * ROWS_PER_BEAT);
        expect(player.beat).toBeCloseTo(1, 9);
    });

    it('reports the row playing, through its loop and into a queued song', () => {
        const looped = createAudio80Song({ ...TUNE_OPTIONS, order: ['a', 'b'], loop: 1 });
        const next = createAudio80Song({ ...TUNE_OPTIONS, order: ['b'] });
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio80SongDriver(chip.writer));
        player.play(looped);
        const places = [[player.orderIndex, player.row]];
        for (let i = 0; i < 13; i++) {
            if (i === 9) player.queue(next);
            tick(chip, player, () => ROW_MS, ROW_MS);
            places.push([player.orderIndex, player.row]);
        }
        expect(places).toEqual([
            [0, 0], [0, 1], [0, 2], [0, 3],
            [1, 0], [1, 1], [1, 2], [1, 3],
            [1, 0], [1, 1], [1, 2], [1, 3],
            [0, 0], [0, 1],
        ]);
        expect(player.song).toBe(next);
        // Each place changes as its row's first note is written, at the chip's time
        expect(listNoteOns(chip.log).filter((write) => write.note === requireNoteNumber('G-5')).map((write) => write.time)).toEqual([4 * ROW_MS, 8 * ROW_MS, 12 * ROW_MS]);
        player.stop();
        expect([player.orderIndex, player.row]).toEqual([0, 0]);
    });

    it('plays every note at its song\'s volume', () => {
        const volume = 0.5;
        const song = createAudio80Song({ ...TUNE_OPTIONS, order: ['a'] });
        const asWritten = listNoteOns(playThrough(song, () => 10, song.durationMs).log);
        const quieter = listNoteOns(playThrough(createAudio80Song({ ...TUNE_OPTIONS, order: ['a'], volume }), () => 10, song.durationMs).log);
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
const ONE_CHANNEL: Audio80SongOptions = { bpm: BPM, rowsPerBeat: ROWS_PER_BEAT, instruments: { L: LEAD }, patterns: { p: '| C-4 L' }, order: ['p'] };

/** The semitones a `u0C` slides by. */
const SLIDE = 0x0C;

/** A slide up an octave, then a row that holds the note. */
const SLIDE_THEN_HOLD = `
    | C-4 L u0C
    | ...
`;

/** One command the song wrote, as the test writer reads it back. Settings are named by their numbers in the commands. */
type Write =
    | { readonly kind: 'note-on'; readonly voice: number; readonly sound: Audio80Sound; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: number; readonly value: number; readonly time: number }
    | { readonly kind: 'set-filter'; readonly filter: number; readonly setting: number; readonly value: number; readonly time: number }
    | { readonly kind: 'set-echo'; readonly setting: number; readonly value: number; readonly time: number };

type NoteOn = Extract<Write, { kind: 'note-on' }>;
type SetVoice = Extract<Write, { kind: 'set-voice' }>;

/** A note's number from its name, for notes the tests write. */
function requireNoteNumber(name: string): number {
    const number = toNoteNumber(name);
    if (number === undefined) throw new Error(`'${name}' is not a note`);
    return number;
}

function listNoteOns(log: readonly Write[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/** The values written to one voice setting, in order. */
function listSettingValues(log: readonly Write[], setting: number): number[] {
    return log.filter((write): write is SetVoice => write.kind === 'set-voice' && write.setting === setting).map((write) => write.value);
}

/**
 * How far `voice` slid between two chip times, in semitones, as the chip
 * would play the log. A slide write sets the rate in semitones a second, and
 * a `noteOn` stops the slide.
 */
function measureSlide(log: readonly Write[], voice: number, fromMs: number, toMs: number): number {
    let rate = 0;
    let at = fromMs;
    let total = 0;
    for (const write of log) {
        const isSlide = write.kind === 'set-voice' && write.setting === VOICE_SETTING_INDEX.slide;
        if ((!isSlide && write.kind !== 'note-on') || !('voice' in write) || write.voice !== voice) continue;
        if (write.time >= toMs) break;
        if (write.time > at) {
            total += rate * (write.time - at) / 1000;
            at = write.time;
        }
        rate = write.kind === 'set-voice' && write.setting === VOICE_SETTING_INDEX.slide ? write.value : 0;
    }
    return total + rate * (toMs - at) / 1000;
}

function listNoteStamps(song: Audio80Song, tickMs: () => number): number[] {
    return listNoteOns(playThrough(song, tickMs, song.durationMs + 100).log).map((write) => write.time);
}

/** The note stamps of TUNE when it starts at the same chip time, either before the update or after it. */
function listStampsWhenPlayed(when: 'before-update' | 'after-update'): number[] {
    const chip = createTestWriter();
    const player = createSongPlayer(createAudio80SongDriver(chip.writer));
    const tickMs = 1000 / 60;
    const startTick = 3;
    const totalMs = TUNE.durationMs + 100;
    for (let i = 0; i * tickMs < totalMs; i++) {
        chip.update(tickMs);
        if (i === startTick && when === 'before-update') player.play(TUNE);
        player.update(tickMs);
        if (i === startTick && when === 'after-update') player.play(TUNE);
    }
    return listNoteOns(chip.log).map((write) => write.time);
}

function playThrough(song: Audio80Song, tickMs: () => number, durationMs: number) {
    const chip = createTestWriter();
    const player = createSongPlayer(createAudio80SongDriver(chip.writer));
    player.play(song);
    tick(chip, player, tickMs, durationMs);
    return { log: chip.log, player };
}

/** Ticks as a chip does: its clock, then its song. */
function tick(chip: { readonly update: (deltaMs: number) => void }, player: SongPlayer<Audio80Song>, tickMs: () => number, durationMs: number): void {
    let elapsed = 0;
    while (elapsed < durationMs) {
        const delta = tickMs();
        elapsed += delta;
        chip.update(delta);
        player.update(delta);
    }
}

function expectClose(actual: readonly number[], expected: readonly number[]): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i]).toBeCloseTo(expected[i], 6);
}

/**
 * A writer for a song to write to, whose `write` is a mock, with a clock the
 * test moves on. `log` reads the calls back, oldest first.
 */
function createTestWriter() {
    const clock = { ms: 0 };
    const sounds: Audio80Sound[] = [];
    const writer: SongWriter<Audio80Sound> = {
        get time() {
            return clock.ms;
        },
        write: vi.fn(),
        soundId(sound) {
            const known = sounds.indexOf(sound);
            return known >= 0 ? known : sounds.push(sound) - 1;
        },
    };
    return {
        writer,
        get log(): Write[] {
            return vi.mocked(writer.write).mock.calls.map(([op, time, a, b, c, d]) => toWrite(op, time, a, b, c, d, sounds));
        },
        clear() {
            vi.mocked(writer.write).mockClear();
        },
        update(deltaMs: number) {
            clock.ms += deltaMs;
        },
    };
}

function toWrite(op: number, time: number, a: number, b: number, c: number, d: number, sounds: readonly Audio80Sound[]): Write {
    switch (op) {
        case OP_NOTE_ON:
            return { kind: 'note-on', voice: a, sound: sounds[b], note: c, volume: d, time };
        case OP_NOTE_OFF:
            return { kind: 'note-off', voice: a, time };
        case OP_SET_VOICE:
            return { kind: 'set-voice', voice: a, setting: b, value: c, time };
        case OP_SET_FILTER:
            return { kind: 'set-filter', filter: a, setting: b, value: c, time };
        case OP_SET_ECHO:
            return { kind: 'set-echo', setting: a, value: b, time };
        default:
            throw new Error(`a song wrote op ${op}, which it never should`);
    }
}
