// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/html';
import { createMusicPlayer, type Song, computeSongDurationMs } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import {
    BET, BIG_WIN, CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS, COIN, FIRST_SETTLE_MS, GAME_OVER, LEVER, NO_WIN, REEL_CLICK,
    REEL_STOP, SETTLE_MS, SETTLE_STAGGER_MS, STOPPING_SETTLE_MS, type SymbolKind, WAY_OF_3, WAY_OF_5, WIN,
} from '../../data';
import { createFruitMachineModel, type FruitMachineModelOptions } from '../../models';
import { MachineAudioView } from './machine-audio-view';

const TICK_MS = 1000 / 60;

describe('MachineAudioView', () => {
    it('tells every song apart over the time a test listens to it', () => {
        const recordings = [recordSong(WIN), recordSong(BIG_WIN), recordSong(GAME_OVER)];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('pulls the lever, clicks while the reels turn, and thunks as each lands, one after another', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(TICK_MS);
        expect(listPlays(t.chip.log, LEVER)).toHaveLength(1);

        // The first reel thunks as it starts to settle, not once it is at rest
        t.advance(FIRST_SETTLE_MS);
        expect(t.model.reels[0].phase).toBe('settling');
        expect(listPlays(t.chip.log, REEL_STOP)).toHaveLength(1);
        // And each of the others in turn, as it starts to settle
        for (let i = 1; i < t.model.reels.length; i++) {
            t.advance(SETTLE_STAGGER_MS);
            expect(listPlays(t.chip.log, REEL_STOP), `reel ${i}`).toHaveLength(i + 1);
        }

        t.advance(LANDED_MS);
        const clicks = listPlays(t.chip.log, REEL_CLICK).length;
        expect(clicks).toBeGreaterThan(10);
        expect(listPlays(t.chip.log, REEL_STOP)).toHaveLength(t.model.reels.length);

        t.advance(1000);
        expect(listPlays(t.chip.log, REEL_CLICK)).toHaveLength(clicks);
    });

    it('thunks once, not once for each reel, when a stop lands every reel at once', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(TICK_MS);
        t.model.stop();
        t.advance(TICK_MS);
        for (const reel of t.model.reels) expect(reel.phase).toBe('settling');
        expect(listPlays(t.chip.log, REEL_STOP)).toHaveLength(1);

        t.advance(STOPPING_SETTLE_MS + TICK_MS);
        expect(t.model.phase).toBe('idle');
        expect(listPlays(t.chip.log, REEL_STOP)).toHaveLength(1);
    });

    it('sighs at a spin that wins nothing, with no jingle', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + 1000);
        expect(listPlays(t.chip.log, NO_WIN)).toHaveLength(1);
        expect(listNoteOns(t.chip.log)).toHaveLength(0);
    });

    it('plays a jingle and a shower of coins for a win, then a chime for its way', () => {
        const t = setUp({ strips: WAY_OF_3_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + CELEBRATION_OPENER_MS);
        expect(describeNoteOns(t.chip.log)).toEqual(recordSong(WIN));
        expect(listPlays(t.chip.log, COIN).length).toBeGreaterThan(5);
        const coins = listPlays(t.chip.log, COIN).length;

        t.advance(CELEBRATION_STEP_MS);
        expect(listPlays(t.chip.log, WAY_OF_3)).toHaveLength(1);
        expect(listPlays(t.chip.log, COIN)).toHaveLength(coins);
        expect(listPlays(t.chip.log, NO_WIN)).toHaveLength(0);
    });

    it('plays the longer jingle for a big win, and a higher chime for a longer way', () => {
        const t = setUp({ strips: WAY_OF_5_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + computeSongDurationMs(BIG_WIN));
        expect(describeNoteOns(t.chip.log)).toEqual(recordSong(BIG_WIN));
        expect(listPlays(t.chip.log, WAY_OF_5)).toHaveLength(1);
    });

    it('plays the slow tune as the credits run out, instead of the sigh', () => {
        const t = setUp({ strips: NO_WIN_STRIPS, startingBalance: BET });
        void t.model.spin();
        t.advance(LANDED_MS + computeSongDurationMs(GAME_OVER));
        expect(t.model.phase).toBe('gameOver');
        expect(describeNoteOns(t.chip.log)).toEqual(recordSong(GAME_OVER));
        expect(listPlays(t.chip.log, NO_WIN)).toHaveLength(0);
    });

    it('cuts a jingle short when the next spin starts', () => {
        const t = setUp({ strips: WAY_OF_3_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + TICK_MS);
        expect(t.model.phase).toBe('celebrating');
        t.model.stop();
        t.advance(TICK_MS);
        void t.model.spin();
        t.chip.clear();
        t.advance(TICK_MS);
        expect(t.chip.log).toContainEqual(expect.objectContaining({ kind: 'reserve-voices', count: 0 }));
        t.chip.clear();
        t.advance(FIRST_SETTLE_MS);
        expect(listNoteOns(t.chip.log)).toHaveLength(0);
    });

    it('plays nothing for a machine at rest, nor for one already over', () => {
        const atRest = setUp({ strips: NO_WIN_STRIPS });
        const over = setUp({ strips: NO_WIN_STRIPS, startingBalance: 0 });
        atRest.advance(1000);
        over.advance(1000);
        expect(atRest.chip.log).toHaveLength(0);
        expect(over.chip.log).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every reel shows its whole strip. The second reel shares no picture with the first, so no way wins. */
const NO_WIN_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
];

/** One way wins. It is the first picture, on the first three reels. */
const WAY_OF_3_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic2', 'pic3', 'pic4'],
    ['pic5', 'pic6', 'pic2'],
];

/** One way wins. It is the first picture, on all five reels, and it pays a big win. */
const WAY_OF_5_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic1', 'pic5', 'pic4'],
    ['pic5', 'pic1', 'pic6'],
];

/** How long the last reel takes to land, from the start of a spin, and one tick more. */
const LANDED_MS = FIRST_SETTLE_MS + (NO_WIN_STRIPS.length - 1) * SETTLE_STAGGER_MS + SETTLE_MS + TICK_MS;

type Play = Extract<ChipWrite, { kind: 'play' }>;
type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;

function setUp(options: FruitMachineModelOptions) {
    const model = createFruitMachineModel({ seed: 5, ...options });
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = MachineAudioView({ model, sound: chip });
    /** Runs ticks as the host does. It advances the chip's clock and the model, then updates and refreshes the view. */
    const advance = (totalMs: number): void => {
        for (let elapsed = 0; elapsed < totalMs; elapsed += TICK_MS) {
            controls.update(TICK_MS);
            model.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    return { model, chip, advance };
}

function listPlays(log: readonly ChipWrite[], effect: Play['effect']): Play[] {
    return log.filter((write): write is Play => write.kind === 'play' && write.effect === effect);
}

function listNoteOns(log: readonly ChipWrite[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/**
 * Describes each note-on in `log` as its voice, its note and its time. The
 * time is in ms from the first note-on, to three decimal places. So two logs
 * of the same song match even when the song started at different chip times.
 * Effects are logged as plays, so every note-on is the music's.
 */
function describeNoteOns(log: readonly ChipWrite[]): string[] {
    const noteOns = listNoteOns(log);
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns.map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` to its end on a music player of its own, and describes the
 * notes it plays. This is what the view should play when it plays `song`.
 * Each test that compares with it listens to the whole song.
 */
function recordSong(song: Song): string[] {
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const music = createMusicPlayer({ audio80: chip });
    music.play(song);
    music.refresh();
    for (let elapsed = 0; elapsed < computeSongDurationMs(song) + 1000; elapsed += TICK_MS) {
        controls.update(TICK_MS);
        music.update(TICK_MS);
        music.refresh();
    }
    return describeNoteOns(chip.log);
}
