import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { computeSongDurationMs, createMusicPlayer, type Song } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { CAUGHT, CLEARED, GAME_START, NIBBLE_HIGH, NIBBLE_LOW, SNEAK } from '../data';
import type { GamePhase } from '../models';
import { GameAudioView, SNEAK_SPEED_UP } from './game-audio-view';

const TICK_MS = 1000 / 60;
const TOTAL_CRUMBS = 100;

/**
 * How long a test listens to a song for, in ms. It falls between rows of
 * every song, so no note lands on the edge. The test 'tells every song apart
 * within the time it listens for' checks that it is long enough.
 */
const LISTEN_MS = 580;

describe('GameAudioView', () => {
    it('tells every song apart within the time it listens for', () => {
        const recordings = [
            recordSong({ song: GAME_START }),
            recordSong({ song: SNEAK }),
            recordSong({ song: SNEAK, tempoScale: 1 + SNEAK_SPEED_UP }),
            recordSong({ song: CAUGHT }),
            recordSong({ song: CLEARED }),
        ];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('plays the start\'s tune as a game starts', () => {
        const { chip, tickFor } = setUp();
        tickFor(LISTEN_MS);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: GAME_START }));
    });

    it('plays the sneaking tune at its own tempo once the start\'s tune ends, with the maze full', () => {
        const { chip, tickFor } = setUp();
        const startMs = listNoteOns(chip.log)[0].time;
        tickFor(computeSongDurationMs(GAME_START) + LISTEN_MS);
        const handOverMs = startMs + computeSongDurationMs(GAME_START);
        expect(describeNoteOns(chip.log, handOverMs)).toEqual(recordSong({ song: SNEAK }));
    });

    it.each([
        { remainingCrumbs: TOTAL_CRUMBS, left: 'every crumb left' },
        { remainingCrumbs: TOTAL_CRUMBS / 2, left: 'half the crumbs left' },
        { remainingCrumbs: 1, left: 'one crumb left' },
    ])('plays the sneaking tune faster the fewer crumbs are left, with $left', ({ remainingCrumbs }) => {
        const { chip, state, tickFor } = setUpSneaking();
        state.remainingCrumbs = remainingCrumbs;
        chip.clear();
        tickFor(2000);
        const tempoScale = 1 + (1 - remainingCrumbs / TOTAL_CRUMBS) * SNEAK_SPEED_UP;
        const rowMs = 60000 / (SNEAK.bpm * SNEAK.rowsPerBeat);
        const bass = listNoteOns(chip.log).filter((write) => write.voice === BASS_VOICE);
        expect(bass.length).toBeGreaterThan(4);
        for (let i = 1; i < bass.length; i++) {
            expect(bass[i].time - bass[i - 1].time).toBeCloseTo(rowMs * SNEAK_BASS_ROWS_APART / tempoScale);
        }
    });

    it.each([
        { phase: 'game-over', song: CAUGHT, remainingCrumbs: 1, ending: 'caught' },
        { phase: 'won', song: CLEARED, remainingCrumbs: 0, ending: 'won' },
    ] as const)('plays its tune at its own tempo as the game ends $ending, after the sneaking tune has sped up', ({ phase, song, remainingCrumbs }) => {
        const { chip, state, tickFor } = setUpSneaking();
        state.remainingCrumbs = remainingCrumbs;
        tickFor(TICK_MS);
        chip.clear();
        state.phase = phase;
        const listenMs = computeSongDurationMs(song);
        tickFor(listenMs);
        expect(describeNoteOns(chip.log, 0, listenMs)).toEqual(recordSong({ song, listenMs }));
    });

    it('plays only the caught tune when the mouse is caught during the start\'s tune', () => {
        const { chip, state, tickFor } = setUp();
        tickFor(1000);
        chip.clear();
        state.phase = 'game-over';
        const listenMs = computeSongDurationMs(GAME_START) + computeSongDurationMs(CAUGHT);
        tickFor(listenMs);
        expect(describeNoteOns(chip.log, 0, listenMs)).toEqual(recordSong({ song: CAUGHT, listenMs }));
    });

    it('plays the start\'s tune again, and no nibble, as a game starts after one ends', () => {
        const { chip, state, tickFor } = setUp();
        state.remainingCrumbs = 40;
        tickFor(TICK_MS);
        state.phase = 'game-over';
        tickFor(TICK_MS);
        chip.clear();
        state.phase = 'playing';
        state.remainingCrumbs = TOTAL_CRUMBS;
        tickFor(LISTEN_MS);
        expect(listPlays(chip.log)).toHaveLength(0);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: GAME_START }));
    });

    it('nibbles for each crumb, low and high by turns, and not as the maze fills again', () => {
        const { chip, state, tickFor } = setUp();
        for (const remaining of [99, 98, 97, TOTAL_CRUMBS]) {
            state.remainingCrumbs = remaining;
            tickFor(TICK_MS);
        }
        const nibbles = listPlays(chip.log).map((write) => write.effect);
        expect(nibbles).toEqual([NIBBLE_HIGH, NIBBLE_LOW, NIBBLE_HIGH]);
    });

    it('plays nothing while it is refreshed but not updated, as when paused', () => {
        const { chip, view } = setUp();
        chip.clear();
        for (let i = 0; i < 120; i++) refreshView(view);
        expect(chip.log).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The voice that plays the songs' bass. The music player plays channel n on voice n, and the bass is channel 1. */
const BASS_VOICE = 1;
/** The sneaking tune's bass plays a note on every second row. */
const SNEAK_BASS_ROWS_APART = 2;

type Play = Extract<ChipWrite, { kind: 'play' }>;
type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;

function listPlays(log: readonly ChipWrite[]): Play[] {
    return log.filter((write): write is Play => write.kind === 'play');
}

function listNoteOns(log: readonly ChipWrite[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/**
 * Describes the note-ons in `log` from `fromMs` on, for `listenMs`, as each
 * one's voice, note and time. The time is in ms from the first of them, to
 * three decimal places. So two logs of the same song match even when the
 * song started at different chip times. Every song plays a note on its first
 * row, so the first note-on marks the song's start.
 */
function describeNoteOns(log: readonly ChipWrite[], fromMs = 0, listenMs = LISTEN_MS): string[] {
    // A thousandth of a ms of slack, for a note stamped at `fromMs` by a sum of floats
    const noteOns = listNoteOns(log).filter((write) => write.time >= fromMs - 0.001);
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns
        .filter((write) => write.time - startMs < listenMs)
        .map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` at `tempoScale` on a music player of its own, for `listenMs`,
 * and describes the notes it plays. This is what the view should play over
 * the same time.
 */
function recordSong(options: { song: Song; tempoScale?: number; listenMs?: number }): string[] {
    const { song, tempoScale = 1, listenMs = LISTEN_MS } = options;
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    player.tempoScale = tempoScale;
    player.play(song);
    player.refresh();
    for (let elapsed = 0; elapsed < listenMs; elapsed += TICK_MS) {
        controls.update(TICK_MS);
        player.update(TICK_MS);
        player.refresh();
    }
    return describeNoteOns(chip.log, 0, listenMs);
}

/** Sets up a view as a game starts, and runs its first tick. */
function setUp() {
    const state = { phase: 'playing' as GamePhase, remainingCrumbs: TOTAL_CRUMBS };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        sound: chip,
        phase: () => state.phase,
        remainingCrumbs: () => state.remainingCrumbs,
        totalCrumbs: TOTAL_CRUMBS,
    });
    const tickFor = (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            controls.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    tickFor(TICK_MS);
    return { chip, state, view, tickFor };
}

/** Sets up a view as a game starts, and runs it until the sneaking tune has played for a second. */
function setUpSneaking() {
    const setup = setUp();
    setup.tickFor(computeSongDurationMs(GAME_START) + 1000);
    return setup;
}
