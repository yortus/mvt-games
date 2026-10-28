import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    BEAT_HIGH, BEAT_LOW, BREAK_LARGE, BREAK_MEDIUM, BREAK_SMALL, FIRE, GAME_OVER, RESPAWN, SHIP_EXPLODE, THRUST,
    WAVE_CLEAR,
} from '../data';
import type { AsteroidSize, GamePhase } from '../models';
import { GameAudioView } from './game-audio-view';

const TICK_MS = 1000 / 60;
/** Enough breaks left for the heartbeat to be at its slowest. */
const MANY_BREAKS = 100;
/** Long enough for several beats, even at the heartbeat's slowest. */
const LONG_MS = 4000;

// The view is tested by what it asks of its chip: which sounds it plays, and when.

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('beats once as the view starts, with the low thump first, then the high one', () => {
        const { chip, tickFor } = setUp();
        expect(listBeats(chip)).toEqual([BEAT_LOW]);
        while (listBeats(chip).length < 2) tickFor(TICK_MS);
        expect(listBeats(chip)).toEqual([BEAT_LOW, BEAT_HIGH]);
    });

    it('beats low and high by turns, and faster with each break', () => {
        const listBeatsWith = (breaksLeft: number): unknown[] => {
            const { chip, state, tickFor } = setUp();
            state.breaksLeft = breaksLeft;
            tickFor(LONG_MS);
            return listBeats(chip);
        };
        const slowest = listBeatsWith(MANY_BREAKS);
        const middle = listBeatsWith(14);
        const fastest = listBeatsWith(1);
        expect(middle.length).toBeGreaterThan(slowest.length);
        expect(fastest.length).toBeGreaterThan(middle.length);
        for (let i = 1; i < fastest.length; i++) expect(fastest[i]).not.toBe(fastest[i - 1]);
    });

    for (const phase of ['dying', 'wave-clear', 'game-over'] as const) {
        it(`stops beating while the game is ${phase}, and beats at once when the ship is back in play`, () => {
            const { chip, state, tickFor } = setUp();
            state.phase = phase;
            tickFor(TICK_MS);
            vi.clearAllMocks();
            tickFor(LONG_MS);
            expect(listBeats(chip)).toHaveLength(0);
            state.phase = 'playing';
            tickFor(TICK_MS);
            expect(listBeats(chip)).toHaveLength(1);
        });
    }

    it('keeps beating while the ship comes back', () => {
        const { chip, state, tickFor } = setUp();
        state.phase = 'respawning';
        tickFor(LONG_MS);
        expect(listBeats(chip).length).toBeGreaterThan(2);
    });

    it('plays nothing while the game is paused, and goes on from where it was', () => {
        const { chip, tickFor, refreshFor } = setUp();
        vi.clearAllMocks();
        refreshFor(LONG_MS);
        expect(chip.play).not.toHaveBeenCalled();
        // The first beat came just before the pause, so the next one is most of a period away
        tickFor(TICK_MS);
        expect(chip.play).not.toHaveBeenCalled();
    });

    it('rumbles while the ship thrusts, starting at once, and stops when it stops', () => {
        const { chip, state, tickFor } = setUp();
        state.isThrusting = true;
        tickFor(TICK_MS);
        expect(listPlayedOf(chip, THRUST)).toHaveLength(1);
        tickFor(1000);
        const bursts = listPlayedOf(chip, THRUST).length;
        expect(bursts).toBeGreaterThan(5);
        state.isThrusting = false;
        tickFor(1000);
        expect(listPlayedOf(chip, THRUST)).toHaveLength(bursts);
    });

    it('stops the rumble when the ship is lost while thrusting', () => {
        const { chip, state, tickFor } = setUp();
        state.isThrusting = true;
        tickFor(TICK_MS);
        state.phase = 'dying';
        tickFor(TICK_MS);
        vi.clearAllMocks();
        tickFor(1000);
        expect(listPlayedOf(chip, THRUST)).toHaveLength(0);
    });

    it('fires once for each shot, even in the next tick', () => {
        const { chip, state, tickFor } = setUp();
        state.shotsFired = 1;
        tickFor(TICK_MS);
        state.shotsFired = 2;
        tickFor(TICK_MS);
        tickFor(TICK_MS);
        expect(listPlayedOf(chip, FIRE)).toHaveLength(2);
    });

    for (const [size, effect] of [['large', BREAK_LARGE], ['medium', BREAK_MEDIUM], ['small', BREAK_SMALL]] as const) {
        it(`plays one ${size} break for each rise in the count, when the last rock broken is ${size}`, () => {
            const { chip, state, tickFor } = setUp();
            state.lastBrokenRockSize = size;
            state.rocksBroken = 1;
            tickFor(TICK_MS);
            // Two rocks in one tick make one sound
            state.rocksBroken = 3;
            tickFor(TICK_MS);
            tickFor(TICK_MS);
            expect(listPlayed(chip).filter(isBreak)).toEqual([effect, effect]);
        });
    }

    for (const [phase, effect] of [
        ['dying', SHIP_EXPLODE], ['respawning', RESPAWN], ['wave-clear', WAVE_CLEAR], ['game-over', GAME_OVER],
    ] as const) {
        it(`plays its sound once as the game turns to ${phase}`, () => {
            const { chip, state, tickFor } = setUp();
            state.phase = phase;
            tickFor(TICK_MS);
            tickFor(TICK_MS);
            expect(listPlayedOf(chip, effect)).toHaveLength(1);
        });
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a headless chip whose `play` is spied on, so a test can read what the view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    return chip;
}

/** The sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** The times `effect` was played on `chip`. */
function listPlayedOf(chip: HeadlessAudio80, effect: unknown): unknown[] {
    return listPlayed(chip).filter((sound) => sound === effect);
}

/** The heartbeat's thumps, in the order they played. */
function listBeats(chip: HeadlessAudio80): unknown[] {
    return listPlayed(chip).filter(isBeat);
}

function isBeat(sound: unknown): boolean {
    return sound === BEAT_LOW || sound === BEAT_HIGH;
}

function isBreak(sound: unknown): boolean {
    return sound === BREAK_LARGE || sound === BREAK_MEDIUM || sound === BREAK_SMALL;
}

/**
 * Makes the view over a state the test can change, and ticks it once, as the
 * game loop would. `tickFor` ticks the chip and the view. `refreshFor` only
 * refreshes the view, as the game loop does while the game is paused.
 */
function setUp() {
    const state = {
        phase: 'playing' as GamePhase,
        shotsFired: 0,
        rocksBroken: 0,
        lastBrokenRockSize: undefined as AsteroidSize | undefined,
        breaksLeft: MANY_BREAKS,
        isThrusting: false,
    };
    const chip = createSpiedChip();
    const view = GameAudioView({
        sfx: chip,
        phase: () => state.phase,
        shotsFired: () => state.shotsFired,
        rocksBroken: () => state.rocksBroken,
        lastBrokenRockSize: () => state.lastBrokenRockSize,
        breaksLeft: () => state.breaksLeft,
        isThrusting: () => state.isThrusting,
    });
    const tickFor = (ms: number): void => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            chip.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    const refreshFor = (ms: number): void => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) refreshView(view);
    };
    tickFor(TICK_MS);
    return { chip, state, tickFor, refreshFor };
}
