import { describe, expect, it, vi } from 'vitest';
import { createSongPlayer, OP_NOTE_OFF, OP_NOTE_ON, OP_SET_VOICE, type SongPlayer, type SongWriter } from '../../shared';
import { measurePeak, render } from '../../headless';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_SETTING_INDEX,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../synthesiser';
import { type Audio90Sound, createAudio90Sound } from './audio90-sound';
import { type Audio90Song, createAudio90Song } from './audio90-song';
import { createAudio90SongDriver } from './audio90-song-driver';
import { toPan } from './to-pan';

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

const TWO_CHANNELS = { bpm: 120, instruments: { S: SAW }, patterns: { p: '| C-4 S | C-3 S' }, order: ['p'] };

describe('createAudio90SongDriver', () => {
    it('sets the song\'s tempo, character, effects, pump and mixer as it starts', () => {
        const chip = createTestWriter();
        const song = createAudio90Song({ ...TWO_CHANNELS, character: 'console', chorus: { level: 0.2 }, mixer: [{ pan: -1 }] });
        createAudio90SongDriver(chip.writer).start(song, 10, 1);
        expect(chip.log).toContainEqual({ op: OP90_SET_TEMPO, time: 10, a: 120, b: 0, c: 0, d: 0 });
        expect(chip.log).toContainEqual({ op: OP90_SET_CHARACTER, time: 10, a: AUDIO90_CHARACTERS.indexOf('console'), b: 0, c: 0, d: 0 });
        expect(chip.log).toContainEqual({ op: OP90_SET_EFFECT, time: 10, a: AUDIO90_EFFECT_INDEX.chorus, b: AUDIO90_EFFECT_SETTING_INDEX.chorus.level, c: 0.2, d: 0 });
        // A song with no pump turns off one a song before may have left on
        expect(chip.log).toContainEqual({ op: OP90_SET_EFFECT, time: 10, a: AUDIO90_EFFECT_INDEX.pump, b: AUDIO90_EFFECT_SETTING_INDEX.pump.voice, c: -1, d: 0 });
        expect(chip.log).toContainEqual({ op: OP_SET_VOICE, time: 10, a: 0, b: AUDIO90_VOICE_SETTING_INDEX.pan, c: -1, d: 0 });
        expect(chip.log).toContainEqual({ op: OP_SET_VOICE, time: 10, a: 1, b: AUDIO90_VOICE_SETTING_INDEX.pan, c: 0, d: 0 });
        expect(chip.log.some((write) => write.op === OP90_SET_EFFECT && write.a === AUDIO90_EFFECT_INDEX.reverb)).toBe(false);
    });

    it('writes a row\'s channel settings before its note, and the note\'s own effects after it', () => {
        const chip = createTestWriter();
        const song = createAudio90Song({ bpm: 120, instruments: { S: SAW }, patterns: { p: '| A-4 S c47 P40 ! r6' }, order: ['p+2'] });
        createAudio90SongDriver(chip.writer).playRow(song, 0, 0, 5, 125, 1);
        const settings = AUDIO90_VOICE_SETTING_INDEX;
        // Each write, as its op, and the setting for a voice's settings
        expect(chip.log.map((write) => (write.op === OP_SET_VOICE ? write.b : write.op))).toEqual([settings.pan, settings.reverbSend, OP_NOTE_ON, settings.accent, settings.chord]);
        expect(chip.log[0]).toMatchObject({ c: toPan(0x40), time: 5 });
        expect(chip.log[2]).toMatchObject({ a: 0, c: 71 });
        expect(chip.sounds[chip.log[2].b]).toBe(SAW);
    });
});

describe('song player, on an Audio90', () => {
    it('writes the song\'s settings, then each row at its chip time', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio90SongDriver(chip.writer));
        player.play(GROOVE);
        chip.update(ROW_MS * 2.5);
        player.update(ROW_MS * 2.5);
        expect(chip.log[0]).toEqual({ op: OP90_SET_TEMPO, time: 0, a: BPM, b: 0, c: 0, d: 0 });
        expect(chip.log).toContainEqual({ op: OP90_SET_EFFECT, time: 0, a: AUDIO90_EFFECT_INDEX.pump, b: AUDIO90_EFFECT_SETTING_INDEX.pump.voice, c: 1, d: 0 });
        expect(chip.log).toContainEqual({ op: OP_SET_VOICE, time: 0, a: 0, b: AUDIO90_VOICE_SETTING_INDEX.pan, c: -0.5, d: 0 });
        // Each note on, as its voice, its note and its time
        expect(listNoteOns(chip.log).map((write) => [write.a, write.c, write.time])).toEqual([[0, 57, 0], [1, 36, 0], [0, 60, 2 * ROW_MS], [1, 36, 2 * ROW_MS]]);
        expect(chip.log).toContainEqual({ op: OP_SET_VOICE, time: 2 * ROW_MS, a: 0, b: AUDIO90_VOICE_SETTING_INDEX.chord, c: 0x47, d: 0 });
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
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio90SongDriver(chip.writer));
        player.play(GROOVE);
        tick(chip, player, ROW_MS, ROW_MS);
        player.tempoScale = 0.5;
        tick(chip, player, ROW_MS, ROW_MS);
        player.tempoScale = 0;
        chip.clear();
        tick(chip, player, ROW_MS, 10 * ROW_MS);
        expect(chip.log).toEqual([{ op: OP90_SET_TEMPO, time: 2 * ROW_MS, a: 0, b: 0, c: 0, d: 0 }]);
        player.tempoScale = 1;
        tick(chip, player, ROW_MS, ROW_MS);
        expect(chip.log).toContainEqual({ op: OP90_SET_TEMPO, time: 12 * ROW_MS, a: BPM, b: 0, c: 0, d: 0 });
    });

    it('plays a queued song at the end of the first, and releases its notes when it stops', () => {
        const chip = createTestWriter();
        const player = createSongPlayer(createAudio90SongDriver(chip.writer));
        const next = createAudio90Song({ bpm: 120, instruments: { S: SAW }, patterns: { p: '| C-5 S' }, order: ['p'] });
        player.play(GROOVE);
        player.queue(next);
        tick(chip, player, 1000 / 60, GROOVE.durationMs + 50);
        expect(player.song).toBe(next);
        // The queued song sets its tempo as it starts, at the end of the first
        expect(chip.log).toContainEqual({ op: OP90_SET_TEMPO, time: GROOVE.durationMs, a: next.bpm, b: 0, c: 0, d: 0 });
        player.stop();
        expect(chip.log.at(-1)).toMatchObject({ op: OP_NOTE_OFF, a: 0 });
        expect(player.song).toBeUndefined();
    });

    it('renders a song in stereo, where the mixer puts each channel', () => {
        const left = createAudio90Song({ bpm: 120, instruments: { S: SAW }, patterns: { p: '| A-3 S\n| ...' }, order: ['p'], mixer: [{ pan: -1 }] });
        const rendered = render(left, { durationMs: 300 });
        expect(measurePeak(rendered.left)).toBeGreaterThan(0.05);
        expect(measurePeak(rendered.right)).toBeLessThan(1e-6);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** GROOVE's note stamps, played once through with ticks of `tickMs`. */
function listNoteStamps(tickMs: () => number): number[] {
    const chip = createTestWriter();
    const player = createSongPlayer(createAudio90SongDriver(chip.writer));
    player.play(GROOVE);
    tick(chip, player, tickMs, GROOVE.durationMs - 1);
    return listNoteOns(chip.log).map((write) => write.time);
}

/** Ticks as a chip does, for `durationMs`: its clock, then its song. */
function tick(chip: { readonly update: (deltaMs: number) => void }, player: SongPlayer<Audio90Song>, tickMs: number | (() => number), durationMs: number): void {
    let elapsed = 0;
    while (elapsed < durationMs - 1e-9) {
        const delta = typeof tickMs === 'number' ? tickMs : tickMs();
        elapsed += delta;
        chip.update(delta);
        player.update(delta);
    }
}

/** One command the song wrote. */
interface Command {
    readonly op: number;
    readonly time: number;
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
}

function listNoteOns(log: readonly Command[]): Command[] {
    return log.filter((write) => write.op === OP_NOTE_ON);
}

/**
 * A writer for a song to write to, whose `write` is a mock, with a clock the
 * test moves on. `log` reads the calls back, oldest first.
 */
function createTestWriter() {
    const clock = { ms: 0 };
    const sounds: Audio90Sound[] = [];
    const writer: SongWriter<Audio90Sound> = {
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
        /** The sounds the song named, each at its id. */
        sounds,
        get log(): Command[] {
            return vi.mocked(writer.write).mock.calls.map(([op, time, a, b, c, d]) => ({ op, time, a, b, c, d }));
        },
        clear() {
            vi.mocked(writer.write).mockClear();
        },
        update(deltaMs: number) {
            clock.ms += deltaMs;
        },
    };
}
