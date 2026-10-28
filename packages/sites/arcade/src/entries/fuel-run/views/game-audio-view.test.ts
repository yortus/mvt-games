import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    BASE_DESTROYED, BASE_SIREN, BOMB_DROP, EXPLOSION, FUEL_ALARM, GAME_OVER, LAUNCH, REFUEL, ROCKET_LAUNCH, RUN_CLEAR, SAUCER,
    SHIP_CRASH, SHOT,
} from '../data';
import { type GamePhase, SECTION_CLEAR_DELAY_MS } from '../models';
import { GameAudioView } from './game-audio-view';

// The view is tested by what it asks of its chips: which songs and sounds it plays, and when. How a chip plays a
// song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('plays the march as a game starts', () => {
        const { music } = setUp();
        expect(listPlayed(music)).toEqual([LAUNCH]);
    });

    it('stops the march and plays the crash as the ship is lost', () => {
        const { music, sfx, state, tickFor } = setUp();
        vi.clearAllMocks();
        state.phase = 'dying';
        tickFor(TICK_MS);
        expect(listPlayed(sfx)).toEqual([SHIP_CRASH]);
        expect(music.stop).toHaveBeenCalledTimes(1);
        expect(music.play).not.toHaveBeenCalled();
    });

    it('plays no music as the ship comes back', () => {
        const { music, state, tickFor } = setUp();
        for (const phase of ['dying', 'respawning'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
        }
        vi.clearAllMocks();
        state.phase = 'playing';
        tickFor(TICK_MS);
        expect(music.play).not.toHaveBeenCalled();
        expect(music.queue).not.toHaveBeenCalled();
    });

    it.each([
        { phase: 'section-clear', song: RUN_CLEAR, tune: 'fanfare as a run is cleared' },
        { phase: 'game-over', song: GAME_OVER, tune: 'lament as the game ends' },
    ] as const)('plays the whole $tune, with nothing cutting it short', ({ phase, song }) => {
        const { music, state, tickFor } = setUp();
        vi.clearAllMocks();
        state.phase = phase;
        tickFor(song.durationMs);
        expect(listPlayed(music)).toEqual([song]);
        expect(music.stop).not.toHaveBeenCalled();
    });

    it('has a fanfare that ends before the next run starts', () => {
        expect(RUN_CLEAR.durationMs).toBeLessThanOrEqual(SECTION_CLEAR_DELAY_MS);
    });

    it.each(['section-clear', 'game-over'] as const)('plays the march as play starts again after %s', (phase) => {
        const { music, state, tickFor } = setUp();
        state.phase = phase;
        tickFor(TICK_MS);
        vi.clearAllMocks();
        state.phase = 'playing';
        tickFor(TICK_MS);
        expect(listPlayed(music)).toEqual([LAUNCH]);
    });

    it.each([
        { count: 'shotsFired', effect: SHOT },
        { count: 'bombsDropped', effect: BOMB_DROP },
        { count: 'rocketsLaunched', effect: ROCKET_LAUNCH },
        { count: 'enemiesDestroyed', effect: EXPLOSION },
        { count: 'fuelTanksDestroyed', effect: REFUEL },
        { count: 'basesDestroyed', effect: BASE_DESTROYED },
    ] as const)('plays one sound, and only its own, each time $count rises', ({ count, effect }) => {
        const { sfx, state, tickFor } = setUp();
        vi.clearAllMocks();
        for (let i = 1; i <= 2; i++) {
            state[count] = i;
            tickFor(TICK_MS * 3);
        }
        expect(listPlayed(sfx)).toEqual([effect, effect]);
    });

    it('hears a rise made by the model in the tick before the view\'s first refresh', () => {
        const { sfx, state, tickFor } = createView();
        state.shotsFired = 1;
        state.rocketsLaunched = 1;
        tickFor(TICK_MS);
        expect(listPlayed(sfx)).toEqual([SHOT, ROCKET_LAUNCH]);
    });

    it('sounds the alarm with fuel low, faster as it runs out, and not with enough', () => {
        const countAlarmsWith = (fuel: number): number => {
            const { sfx, state, tickFor } = setUp();
            state.fuel = fuel;
            tickFor(3000);
            return listPlayedOf(sfx, FUEL_ALARM).length;
        };
        expect(countAlarmsWith(0.9)).toBe(0);
        expect(countAlarmsWith(0.2)).toBeGreaterThan(0);
        expect(countAlarmsWith(0.05)).toBeGreaterThan(countAlarmsWith(0.2));
    });

    it('warbles while saucers fly, and sounds the siren while waiting at the base', () => {
        const { sfx, state, tickFor } = setUp();
        tickFor(1000);
        expect(listPlayedOf(sfx, SAUCER)).toHaveLength(0);
        expect(listPlayedOf(sfx, BASE_SIREN)).toHaveLength(0);
        state.saucersFlying = 2;
        state.isWaitingAtBase = true;
        tickFor(2000);
        expect(listPlayedOf(sfx, SAUCER).length).toBeGreaterThan(2);
        expect(listPlayedOf(sfx, BASE_SIREN).length).toBeGreaterThan(1);
    });

    it('repeats no sound outside play', () => {
        const { sfx, state, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        for (const phase of ['dying', 'respawning', 'section-clear', 'game-over'] as const) {
            state.phase = phase;
            tickFor(TICK_MS);
            vi.clearAllMocks();
            tickFor(1000);
            expect(sfx.play, phase).not.toHaveBeenCalled();
        }
    });

    it('asks nothing of its chips while it is refreshed but not updated, as when paused', () => {
        const { music, sfx, state, view, tickFor } = setUp();
        Object.assign(state, { fuel: 0.05, saucersFlying: 2, isWaitingAtBase: true });
        tickFor(TICK_MS);
        vi.clearAllMocks();
        for (let i = 0; i < 120; i++) refreshView(view);
        for (const chip of [music, sfx]) {
            expect(chip.play).not.toHaveBeenCalled();
            expect(chip.queue).not.toHaveBeenCalled();
            expect(chip.stop).not.toHaveBeenCalled();
        }
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Creates a headless chip whose `play`, `queue` and `stop` are spied on, so a test can read what a view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'queue');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** Each play of `sound` on `chip`. */
function listPlayedOf(chip: HeadlessAudio80, sound: unknown): unknown[] {
    return listPlayed(chip).filter((played) => played === sound);
}

/** Creates a view as a game starts, before its first tick. */
function createView() {
    const state = { phase: 'playing' as GamePhase, ...START };
    const music = createSpiedChip();
    const sfx = createSpiedChip();
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
