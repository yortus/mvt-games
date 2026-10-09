import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../data';
import type { AsteroidModel } from './asteroid-model';
import { createGameModel, type GameModel } from './game-model';

const TICK_MS = 1000 / 60;
/** Long enough for the ship, spinning and firing, to clear the first wave. */
const LONGEST_RUN_MS = 60_000;

describe('GameModel: what it keeps for the views to hear', () => {
    // Seed the random numbers, so the rocks start in the same places on every run
    beforeEach(() => {
        let state = 12345;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('counts each shot fired, and starts again at 0 with a new game', () => {
        const model = createGameModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });
        for (let shot = 0; shot < 3; shot++) {
            model.playerInput.firePressed = true;
            model.update(TICK_MS);
            model.playerInput.firePressed = false;
            model.update(TICK_MS);
        }
        expect(model.shotsFired).toBe(3);
        model.reset();
        expect(model.shotsFired).toBe(0);
    });

    it('counts each rock broken and keeps its size, though the rock leaves the list in the same tick', () => {
        const model = createGameModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });
        expect(model.lastBrokenRockSize).toBeUndefined();
        let countBefore = 0;
        let ticksWithOneBreak = 0;
        playUntilWaveEnds(model, (before) => {
            // Only shots break rocks, so each rock that died this tick was broken
            const broken = before.filter((rock) => !rock.isAlive);
            expect(model.rocksBroken).toBe(countBefore + broken.length);
            for (const rock of broken) expect(listRocks(model)).not.toContain(rock);
            if (broken.length === 1) {
                expect(model.lastBrokenRockSize).toBe(broken[0].size);
                ticksWithOneBreak++;
            }
            countBefore = model.rocksBroken;
        });
        expect(ticksWithOneBreak).toBeGreaterThan(0);
    });

    it('counts down the breaks left in the wave by one for each rock broken, to 0 as the wave is cleared', () => {
        const model = createGameModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });
        const breaksAtStart = model.breaksLeft;
        expect(breaksAtStart).toBeGreaterThan(listRocks(model).length);
        playUntilWaveEnds(model, () => {
            expect(model.breaksLeft).toBe(breaksAtStart - model.rocksBroken);
        });
        expect(model.phase).toBe('wave-clear');
        expect(model.breaksLeft).toBe(0);
    });

    it('starts the rock counts again with a new game', () => {
        const model = createGameModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });
        const breaksAtStart = model.breaksLeft;
        playUntilWaveEnds(model, () => undefined);
        expect(model.rocksBroken).toBeGreaterThan(0);
        model.reset();
        expect(model.rocksBroken).toBe(0);
        expect(model.lastBrokenRockSize).toBeUndefined();
        expect(model.breaksLeft).toBe(breaksAtStart);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Spins the ship and fires in bursts until the first wave is cleared or the
 * game is over. After each tick, it calls `check` with the rocks that were
 * alive before the tick.
 */
function playUntilWaveEnds(model: GameModel, check: (before: AsteroidModel[]) => void): void {
    model.playerInput.rotationDirection = 'left';
    for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && !hasWaveEnded(model); i++) {
        model.playerInput.firePressed = i % 8 < 4;
        const before = listRocks(model).filter((rock) => rock.isAlive);
        model.update(TICK_MS);
        check(before);
    }
}

function hasWaveEnded(model: GameModel): boolean {
    return model.phase === 'wave-clear' || model.phase === 'game-over';
}

function listRocks(model: GameModel): AsteroidModel[] {
    const rocks: AsteroidModel[] = [];
    for (let i = 0; i < model.asteroids.slots.length; i++) {
        const slot = model.asteroids.slots.at(i);
        if (slot !== undefined) rocks.push(slot.value);
    }
    return rocks;
}
