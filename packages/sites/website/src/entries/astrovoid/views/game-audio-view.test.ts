import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { SoundEffect } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
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

describe('GameAudioView', () => {
    it('beats once as the view starts, with the low thump first, then the high one', () => {
        const { chip, tickFor } = setUp();
        expect(listBeats(chip.log)).toEqual([BEAT_LOW]);
        while (listBeats(chip.log).length < 2) tickFor(TICK_MS);
        expect(listBeats(chip.log)).toEqual([BEAT_LOW, BEAT_HIGH]);
    });

    it('beats low and high by turns, and faster with each break', () => {
        const listBeatsWith = (breaksLeft: number): SoundEffect[] => {
            const { chip, state, tickFor } = setUp();
            state.breaksLeft = breaksLeft;
            tickFor(LONG_MS);
            return listBeats(chip.log);
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
            chip.clear();
            tickFor(LONG_MS);
            expect(listBeats(chip.log)).toHaveLength(0);
            state.phase = 'playing';
            tickFor(TICK_MS);
            expect(listBeats(chip.log)).toHaveLength(1);
        });
    }

    it('keeps beating while the ship comes back', () => {
        const { chip, state, tickFor } = setUp();
        state.phase = 'respawning';
        tickFor(LONG_MS);
        expect(listBeats(chip.log).length).toBeGreaterThan(2);
    });

    it('plays nothing while the game is paused, and goes on from where it was', () => {
        const { chip, tickFor, refreshFor } = setUp();
        chip.clear();
        refreshFor(LONG_MS);
        expect(listPlays(chip.log)).toHaveLength(0);
        // The first beat came just before the pause, so the next one is most of a period away
        tickFor(TICK_MS);
        expect(listPlays(chip.log)).toHaveLength(0);
    });

    it('rumbles while the ship thrusts, starting at once, and stops when it stops', () => {
        const { chip, state, tickFor } = setUp();
        state.isThrusting = true;
        tickFor(TICK_MS);
        expect(listPlaysOf(chip.log, THRUST)).toHaveLength(1);
        tickFor(1000);
        const bursts = listPlaysOf(chip.log, THRUST).length;
        expect(bursts).toBeGreaterThan(5);
        state.isThrusting = false;
        tickFor(1000);
        expect(listPlaysOf(chip.log, THRUST)).toHaveLength(bursts);
    });

    it('stops the rumble when the ship is lost while thrusting', () => {
        const { chip, state, tickFor } = setUp();
        state.isThrusting = true;
        tickFor(TICK_MS);
        state.phase = 'dying';
        tickFor(TICK_MS);
        chip.clear();
        tickFor(1000);
        expect(listPlaysOf(chip.log, THRUST)).toHaveLength(0);
    });

    it('fires once for each shot, even in the next tick', () => {
        const { chip, state, tickFor } = setUp();
        state.shotsFired = 1;
        tickFor(TICK_MS);
        state.shotsFired = 2;
        tickFor(TICK_MS);
        tickFor(TICK_MS);
        expect(listPlaysOf(chip.log, FIRE)).toHaveLength(2);
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
            expect(listPlays(chip.log).filter((write) => isBreak(write.effect))).toEqual([
                expect.objectContaining({ effect }),
                expect.objectContaining({ effect }),
            ]);
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
            expect(listPlaysOf(chip.log, effect)).toHaveLength(1);
        });
    }

    it('plays nothing for the counts it starts with, or as they go back to 0 for a new game', () => {
        const { chip, state, tickFor } = setUp({ shotsFired: 12, rocksBroken: 7 });
        expect(listOtherPlays(chip.log)).toHaveLength(0);
        state.phase = 'game-over';
        tickFor(TICK_MS);
        chip.clear();
        state.phase = 'playing';
        state.shotsFired = 0;
        state.rocksBroken = 0;
        tickFor(TICK_MS);
        expect(listOtherPlays(chip.log)).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<ChipWrite, { kind: 'play' }>;

function listPlays(log: readonly ChipWrite[]): Play[] {
    return log.filter((write): write is Play => write.kind === 'play');
}

function listPlaysOf(log: readonly ChipWrite[], effect: SoundEffect): Play[] {
    return listPlays(log).filter((write) => write.effect === effect);
}

/** Returns the heartbeat's thumps, in the order they played. */
function listBeats(log: readonly ChipWrite[]): SoundEffect[] {
    return listPlays(log).filter((write) => isBeat(write.effect)).map((write) => write.effect);
}

/** Returns the plays that are not the heartbeat's. */
function listOtherPlays(log: readonly ChipWrite[]): Play[] {
    return listPlays(log).filter((write) => !isBeat(write.effect));
}

function isBeat(effect: SoundEffect): boolean {
    return effect === BEAT_LOW || effect === BEAT_HIGH;
}

function isBreak(effect: SoundEffect): boolean {
    return effect === BREAK_LARGE || effect === BREAK_MEDIUM || effect === BREAK_SMALL;
}

/**
 * Makes the view over a state the test can change, and ticks it once, as the
 * game loop would. `tickFor` ticks the chip and the view. `refreshFor` only
 * refreshes the view, as the game loop does while the game is paused.
 */
function setUp(initial: Partial<{ shotsFired: number; rocksBroken: number }> = {}) {
    const state = {
        phase: 'playing' as GamePhase,
        shotsFired: initial.shotsFired ?? 0,
        rocksBroken: initial.rocksBroken ?? 0,
        lastBrokenRockSize: undefined as AsteroidSize | undefined,
        breaksLeft: MANY_BREAKS,
        isThrusting: false,
    };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        sound: chip,
        phase: () => state.phase,
        shotsFired: () => state.shotsFired,
        rocksBroken: () => state.rocksBroken,
        lastBrokenRockSize: () => state.lastBrokenRockSize,
        breaksLeft: () => state.breaksLeft,
        isThrusting: () => state.isThrusting,
    });
    const tickFor = (ms: number): void => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            controls.update(TICK_MS);
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
