import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { computeSongDurationMs, type Audio80Song, type Audio80Sound } from 'audio90';
import { type Audio80Write, createHeadlessAudio80 } from 'audio90/headless';
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
        const { music, tickFor } = setUp();
        tickFor(LISTEN_MS);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it('stops the march and plays the crash as the ship is lost', () => {
        const { music, sfx, state, tickFor } = setUp();
        tickFor(TICK_MS);
        music.clear();
        sfx.clear();
        state.phase = 'dying';
        tickFor(LISTEN_MS);
        expect(listPlays(sfx.log).map((write) => write.sound)).toEqual([SHIP_CRASH]);
        expect(listNoteOns(music.log)).toHaveLength(0);
    });

    it('plays no music as the ship comes back', () => {
        const { music, sfx, state, tickFor } = setUp();
        for (const phase of ['dying', 'respawning'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
        }
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        tickFor(LISTEN_MS);
        expect(listNoteOns(music.log)).toHaveLength(0);
    });

    it('plays the whole fanfare as a run is cleared, and it ends before the next run starts', () => {
        const { music, sfx, state, tickFor } = setUp();
        music.clear();
        sfx.clear();
        state.phase = 'section-clear';
        const listenMs = computeSongDurationMs(RUN_CLEAR);
        tickFor(listenMs);
        expect(describeNoteOns(music.log, 0, listenMs)).toEqual(recordSong({ song: RUN_CLEAR, listenMs }));
        expect(listenMs).toBeLessThanOrEqual(SECTION_CLEAR_DELAY_MS);
    });

    it('plays the march as the next run starts', () => {
        const { music, sfx, state, tickFor } = setUp();
        state.phase = 'section-clear';
        tickFor(SECTION_CLEAR_DELAY_MS);
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        tickFor(LISTEN_MS);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it('plays the whole lament as the game ends', () => {
        const { music, sfx, state, tickFor } = setUp();
        state.phase = 'dying';
        tickFor(TICK_MS);
        music.clear();
        sfx.clear();
        state.phase = 'game-over';
        const listenMs = computeSongDurationMs(GAME_OVER);
        tickFor(listenMs);
        expect(describeNoteOns(music.log, 0, listenMs)).toEqual(recordSong({ song: GAME_OVER, listenMs }));
    });

    it('plays the march, and no other sound, as a new game starts after one ends', () => {
        const { music, sfx, state, tickFor } = setUp();
        Object.assign(state, { shotsFired: 9, bombsDropped: 8, rocketsLaunched: 7, enemiesDestroyed: 6, fuelTanksDestroyed: 5, basesDestroyed: 1 });
        tickFor(TICK_MS);
        state.phase = 'game-over';
        tickFor(TICK_MS);
        music.clear();
        sfx.clear();
        Object.assign(state, { ...START, phase: 'playing' });
        tickFor(LISTEN_MS);
        expect(listPlays(sfx.log)).toHaveLength(0);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LAUNCH }));
    });

    it.each([
        { count: 'shotsFired', effect: SHOT },
        { count: 'bombsDropped', effect: BOMB_DROP },
        { count: 'rocketsLaunched', effect: ROCKET_LAUNCH },
        { count: 'enemiesDestroyed', effect: EXPLOSION },
        { count: 'fuelTanksDestroyed', effect: REFUEL },
        { count: 'basesDestroyed', effect: BASE_DESTROYED },
    ] as const)('plays one sound, and only its own, each time $count rises', ({ count, effect }) => {
        const { music, sfx, state, tickFor } = setUp();
        music.clear();
        sfx.clear();
        for (let i = 1; i <= 2; i++) {
            state[count] = i;
            tickFor(TICK_MS * 3);
        }
        expect(listPlays(sfx.log).map((write) => write.sound)).toEqual([effect, effect]);
    });

    it('hears a rise made by the model in the tick before the view\'s first refresh', () => {
        const { sfx, state, tickFor } = createView();
        state.shotsFired = 1;
        state.rocketsLaunched = 1;
        tickFor(TICK_MS);
        expect(listPlays(sfx.log).map((write) => write.sound)).toEqual([SHOT, ROCKET_LAUNCH]);
    });

    it('sounds the alarm with fuel low, faster as it runs out, and not with enough', () => {
        const countAlarmsWith = (fuel: number): number => {
            const { sfx, state, tickFor } = setUp();
            state.fuel = fuel;
            tickFor(3000);
            return listPlaysOf(sfx.log, FUEL_ALARM).length;
        };
        expect(countAlarmsWith(0.9)).toBe(0);
        expect(countAlarmsWith(0.2)).toBeGreaterThan(0);
        expect(countAlarmsWith(0.05)).toBeGreaterThan(countAlarmsWith(0.2));
    });

    it('warbles while saucers fly, and sounds the siren while waiting at the base', () => {
        const { sfx, state, tickFor } = setUp();
        tickFor(1000);
        expect(listPlaysOf(sfx.log, SAUCER)).toHaveLength(0);
        expect(listPlaysOf(sfx.log, BASE_SIREN)).toHaveLength(0);
        state.saucersFlying = 2;
        state.isWaitingAtBase = true;
        tickFor(2000);
        expect(listPlaysOf(sfx.log, SAUCER).length).toBeGreaterThan(2);
        expect(listPlaysOf(sfx.log, BASE_SIREN).length).toBeGreaterThan(1);
    });

    it('repeats no sound outside play', () => {
        const { music, sfx, state, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        for (const phase of ['dying', 'respawning', 'section-clear', 'game-over'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
            music.clear();
            sfx.clear();
            tickFor(1000);
            expect(listPlays(sfx.log), phase).toHaveLength(0);
        }
    });

    it('plays nothing while it is refreshed but not updated, as when paused', () => {
        const { music, sfx, state, view, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        tickFor(TICK_MS);
        music.clear();
        sfx.clear();
        for (let i = 0; i < 120; i++) refreshView(view);
        expect([music.log, sfx.log]).toEqual([[], []]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<Audio80Write, { kind: 'play' }>;
type NoteOn = Extract<Audio80Write, { kind: 'note-on' }>;

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

function listPlays(log: readonly Audio80Write[]): Play[] {
    return log.filter((write): write is Play => write.kind === 'play');
}

function listPlaysOf(log: readonly Audio80Write[], effect: Audio80Sound): Play[] {
    return listPlays(log).filter((write) => write.sound === effect);
}

function listNoteOns(log: readonly Audio80Write[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/**
 * Describes the note-ons in `log` from `fromMs` on, for `listenMs`, as each
 * one's voice, note and time. The time is in ms from the first of them, to
 * three decimal places. So two logs of the same song match even when the
 * song started at different chip times. Every song plays a note on its first
 * row, so the first note-on marks the song's start.
 */
function describeNoteOns(log: readonly Audio80Write[], fromMs = 0, listenMs = LISTEN_MS): string[] {
    // A thousandth of a ms of slack, for a note stamped at `fromMs` by a sum of floats
    const noteOns = listNoteOns(log).filter((write) => write.time >= fromMs - 0.001);
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns
        .filter((write) => write.time - startMs < listenMs)
        .map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` on a chip of its own, for `listenMs`, and describes
 * the notes it plays. This is what the view should play over the same time.
 */
function recordSong(options: { song: Audio80Song; listenMs?: number }): string[] {
    const { song, listenMs = LISTEN_MS } = options;
    const chip = createHeadlessAudio80({ record: true });
    chip.play(song);
    for (let elapsed = 0; elapsed < listenMs; elapsed += TICK_MS) {
        chip.update(TICK_MS);
    }
    return describeNoteOns(chip.log, 0, listenMs);
}

/** Creates a view as a game starts, before its first tick. */
function createView() {
    const state = { phase: 'playing' as GamePhase, ...START };
    const music = createHeadlessAudio80({ record: true });
    const sfx = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        music,
        sfx,
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
    // A tick as the game loop runs one: the chips' clocks, then the view's update and refresh
    const tickFor = (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            music.update(TICK_MS);
            sfx.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    return { music, sfx, state, view, tickFor };
}

/** Creates a view as a game starts, and runs its first tick. */
function setUp() {
    const setup = createView();
    setup.tickFor(TICK_MS);
    return setup;
}
