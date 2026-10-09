import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { computeSongDurationMs, createMusicPlayer, type Song, type SoundEffect } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import {
    BASE_DESTROYED, BASE_SIREN, BOMB_DROP, EXPLOSION, FUEL_ALARM, GAME_OVER, LAUNCH, REFUEL, ROCKET_LAUNCH, RUN_CLEAR, SAUCER,
    SHIP_CRASH, SHOT,
} from '../data';
import { type GamePhase, SECTION_CLEAR_DELAY_MS } from '../models';
import { GameAudioView } from './game-audio-view';

const TICK_MS = 1000 / 60;

/**
 * How long a test listens to a song for, in ms. It falls between rows of
 * every song, so no note lands on the edge. The test 'tells every song apart
 * within the time it listens for' checks that it is long enough.
 */
const LISTEN_MS = 450;

describe('GameAudioView', () => {
    it('tells every song apart within the time it listens for', () => {
        const recordings = [recordSong({ song: LAUNCH }), recordSong({ song: RUN_CLEAR }), recordSong({ song: GAME_OVER })];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('plays the march as a game starts', () => {
        const { chip, tickFor } = setUp();
        tickFor(LISTEN_MS);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it('stops the march and plays the crash as the ship is lost', () => {
        const { chip, state, tickFor } = setUp();
        tickFor(TICK_MS);
        chip.clear();
        state.phase = 'dying';
        tickFor(LISTEN_MS);
        expect(listPlays(chip.log).map((write) => write.effect)).toEqual([SHIP_CRASH]);
        expect(listNoteOns(chip.log)).toHaveLength(0);
    });

    it('plays no music as the ship comes back', () => {
        const { chip, state, tickFor } = setUp();
        for (const phase of ['dying', 'respawning'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
        }
        chip.clear();
        state.phase = 'playing';
        tickFor(LISTEN_MS);
        expect(listNoteOns(chip.log)).toHaveLength(0);
    });

    it('plays the whole fanfare as a run is cleared, and it ends before the next run starts', () => {
        const { chip, state, tickFor } = setUp();
        chip.clear();
        state.phase = 'section-clear';
        const listenMs = computeSongDurationMs(RUN_CLEAR);
        tickFor(listenMs);
        expect(describeNoteOns(chip.log, 0, listenMs)).toEqual(recordSong({ song: RUN_CLEAR, listenMs }));
        expect(listenMs).toBeLessThanOrEqual(SECTION_CLEAR_DELAY_MS);
    });

    it('plays the march as the next run starts', () => {
        const { chip, state, tickFor } = setUp();
        state.phase = 'section-clear';
        tickFor(SECTION_CLEAR_DELAY_MS);
        chip.clear();
        state.phase = 'playing';
        tickFor(LISTEN_MS);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it('plays the whole lament as the game ends', () => {
        const { chip, state, tickFor } = setUp();
        state.phase = 'dying';
        tickFor(TICK_MS);
        chip.clear();
        state.phase = 'game-over';
        const listenMs = computeSongDurationMs(GAME_OVER);
        tickFor(listenMs);
        expect(describeNoteOns(chip.log, 0, listenMs)).toEqual(recordSong({ song: GAME_OVER, listenMs }));
    });

    it('plays the march, and no other sound, as a new game starts after one ends', () => {
        const { chip, state, tickFor } = setUp();
        Object.assign(state, { shotsFired: 9, bombsDropped: 8, rocketsLaunched: 7, enemiesDestroyed: 6, fuelTanksDestroyed: 5, basesDestroyed: 1 });
        tickFor(TICK_MS);
        state.phase = 'game-over';
        tickFor(TICK_MS);
        chip.clear();
        Object.assign(state, { ...START, phase: 'playing' });
        tickFor(LISTEN_MS);
        expect(listPlays(chip.log)).toHaveLength(0);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it.each([
        { count: 'shotsFired', effect: SHOT },
        { count: 'bombsDropped', effect: BOMB_DROP },
        { count: 'rocketsLaunched', effect: ROCKET_LAUNCH },
        { count: 'enemiesDestroyed', effect: EXPLOSION },
        { count: 'fuelTanksDestroyed', effect: REFUEL },
        { count: 'basesDestroyed', effect: BASE_DESTROYED },
    ] as const)('plays one sound, and only its own, each time $count rises', ({ count, effect }) => {
        const { chip, state, tickFor } = setUp();
        chip.clear();
        for (let i = 1; i <= 2; i++) {
            state[count] = i;
            tickFor(TICK_MS * 3);
        }
        expect(listPlays(chip.log).map((write) => write.effect)).toEqual([effect, effect]);
    });

    it('hears a rise made by the model in the tick before the view\'s first refresh', () => {
        const { chip, state, tickFor } = createView();
        state.shotsFired = 1;
        state.rocketsLaunched = 1;
        tickFor(TICK_MS);
        expect(listPlays(chip.log).map((write) => write.effect)).toEqual([SHOT, ROCKET_LAUNCH]);
    });

    it('sounds the alarm with fuel low, faster as it runs out, and not with enough', () => {
        const countAlarmsWith = (fuel: number): number => {
            const { chip, state, tickFor } = setUp();
            state.fuel = fuel;
            tickFor(3000);
            return listPlaysOf(chip.log, FUEL_ALARM).length;
        };
        expect(countAlarmsWith(0.9)).toBe(0);
        expect(countAlarmsWith(0.2)).toBeGreaterThan(0);
        expect(countAlarmsWith(0.05)).toBeGreaterThan(countAlarmsWith(0.2));
    });

    it('warbles while saucers fly, and sounds the siren while waiting at the base', () => {
        const { chip, state, tickFor } = setUp();
        tickFor(1000);
        expect(listPlaysOf(chip.log, SAUCER)).toHaveLength(0);
        expect(listPlaysOf(chip.log, BASE_SIREN)).toHaveLength(0);
        state.saucersFlying = 2;
        state.isWaitingAtBase = true;
        tickFor(2000);
        expect(listPlaysOf(chip.log, SAUCER).length).toBeGreaterThan(2);
        expect(listPlaysOf(chip.log, BASE_SIREN).length).toBeGreaterThan(1);
    });

    it('repeats no sound outside play', () => {
        const { chip, state, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        for (const phase of ['dying', 'respawning', 'section-clear', 'game-over'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
            chip.clear();
            tickFor(1000);
            expect(listPlays(chip.log), phase).toHaveLength(0);
        }
    });

    it('plays nothing while it is refreshed but not updated, as when paused', () => {
        const { chip, state, view, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        tickFor(TICK_MS);
        chip.clear();
        for (let i = 0; i < 120; i++) refreshView(view);
        expect(chip.log).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<ChipWrite, { kind: 'play' }>;
type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;

/** The bindings' values as a game starts. */
const START = {
    shotsFired: 0,
    bombsDropped: 0,
    rocketsLaunched: 0,
    enemiesDestroyed: 0,
    fuelTanksDestroyed: 0,
    basesDestroyed: 0,
    fuel: 1,
    saucersFlying: 0,
    isWaitingAtBase: false,
};

function listPlays(log: readonly ChipWrite[]): Play[] {
    return log.filter((write): write is Play => write.kind === 'play');
}

function listPlaysOf(log: readonly ChipWrite[], effect: SoundEffect): Play[] {
    return listPlays(log).filter((write) => write.effect === effect);
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
 * Plays `song` on a music player of its own, for `listenMs`, and describes
 * the notes it plays. This is what the view should play over the same time.
 */
function recordSong(options: { song: Song; listenMs?: number }): string[] {
    const { song, listenMs = LISTEN_MS } = options;
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    player.play(song);
    player.refresh();
    for (let elapsed = 0; elapsed < listenMs; elapsed += TICK_MS) {
        controls.update(TICK_MS);
        player.update(TICK_MS);
        player.refresh();
    }
    return describeNoteOns(chip.log, 0, listenMs);
}

/** Creates a view as a game starts, before its first tick. */
function createView() {
    const state = { phase: 'playing' as GamePhase, ...START };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        sound: chip,
        phase: () => state.phase,
        shotsFired: () => state.shotsFired,
        bombsDropped: () => state.bombsDropped,
        rocketsLaunched: () => state.rocketsLaunched,
        enemiesDestroyed: () => state.enemiesDestroyed,
        fuelTanksDestroyed: () => state.fuelTanksDestroyed,
        basesDestroyed: () => state.basesDestroyed,
        fuel: () => state.fuel,
        saucersFlying: () => state.saucersFlying,
        isWaitingAtBase: () => state.isWaitingAtBase,
    });
    // A tick as the game loop runs one: the chip's clock, then the view's update and refresh
    const tickFor = (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            controls.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    return { chip, state, view, tickFor };
}

/** Creates a view as a game starts, and runs its first tick. */
function setUp() {
    const setup = createView();
    setup.tickFor(TICK_MS);
    return setup;
}
