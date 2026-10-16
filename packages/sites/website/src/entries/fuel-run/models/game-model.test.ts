import { describe, it, expect } from 'vitest';
import { createGameModel } from './game-model';
import type { SectionProfile } from '../data';
import { SECTIONS } from '../data';
import { MAX_FUEL_TANKS, ROCKET_DETECT_RANGE, SCROLL_SPEED, SHIP_START_COL, SHIP_START_ROW } from './model-constants';

// Minimal section for focused tests: 30 cols, flat floor at height 2, no ceiling
function makeSection(cols: number, floorHeight = 2): SectionProfile {
    return {
        floor: new Array(cols).fill(floorHeight),
        ceiling: new Array(cols).fill(0),
        spawns: [],
    };
}

function makeGame(sections?: readonly SectionProfile[]) {
    return createGameModel({ sections: sections ?? [makeSection(100)] });
}

describe('GameModel', () => {
    describe('initial state', () => {
        it('starts in playing phase', () => {
            const g = makeGame();
            expect(g.phase).toBe('playing');
        });

        it('pools start empty', () => {
            const g = makeGame();
            expect(g.bullets.slots.length).toBe(0);
            expect(g.bombs.slots.length).toBe(0);
            expect(g.rockets.slots.length).toBe(0);
            expect(g.ufos.slots.length).toBe(0);
            expect(g.fuelTanks.slots.length).toBe(0);
            expect(g.explosions.slots.length).toBe(0);
        });

        it('starts with scroll at 0', () => {
            const g = makeGame();
            expect(g.scrollCol).toBe(0);
        });

        it('ship starts alive', () => {
            const g = makeGame();
            expect(g.ship.isAlive).toBe(true);
        });
    });

    describe('scrolling', () => {
        it('scroll advances during playing phase', () => {
            const g = makeGame();
            g.update(1000); // 1 second at SCROLL_SPEED
            expect(g.scrollCol).toBeCloseTo(SCROLL_SPEED, 1);
        });
    });

    describe('firing', () => {
        it('fires a bullet on fire press', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.update(16);
            expect(g.bullets.liveCount).toBe(1);
        });

        it('does not fire more than one bullet per press', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.update(16);
            g.update(16); // same press held
            expect(g.bullets.liveCount).toBe(1);
        });

        it('fires another bullet after releasing and pressing again', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.update(16);
            g.playerInput.firePressed = false;
            g.update(16);
            g.playerInput.firePressed = true;
            g.update(16);
            expect(g.bullets.liveCount).toBe(2);
        });

        it('drops a bomb on bomb press', () => {
            const g = makeGame();
            g.playerInput.bombPressed = true;
            g.update(16);
            expect(g.bombs.liveCount).toBe(1);
        });
    });

    describe('what it keeps for the views to hear', () => {
        it('counts shots fired and bombs dropped, and starts again at 0 with a new game', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.playerInput.bombPressed = true;
            g.update(16);
            g.playerInput.firePressed = false;
            g.playerInput.bombPressed = false;
            g.update(16);
            g.playerInput.firePressed = true;
            g.update(16);
            expect(g.shotsFired).toBe(2);
            expect(g.bombsDropped).toBe(1);
            g.reset();
            expect(g.shotsFired).toBe(0);
            expect(g.bombsDropped).toBe(0);
        });

        it('counts each rocket as it launches, even one that launches in the tick it appears', () => {
            const g = createGameModel({
                sections: [{
                    ...makeSection(100),
                    spawns: [
                        // Within the ship's detect range at the start, so it launches at once
                        { col: SHIP_START_COL + ROCKET_DETECT_RANGE / 2, row: 0, kind: 'rocket' },
                        // Out of range at the start
                        { col: SHIP_START_COL + ROCKET_DETECT_RANGE * 2, row: 0, kind: 'rocket' },
                    ],
                }],
            });
            g.update(16);
            expect(g.rockets.liveCount).toBe(2);
            expect(g.rocketsLaunched).toBe(1);
        });

        it('counts a fuel tank destroyed by a bomb as an enemy and as a fuel tank', () => {
            // A row of tanks, one in each slot, under the first bomb's path
            const spawns = Array.from({ length: MAX_FUEL_TANKS }, (_, i) => ({ col: 6 + i, row: 0, kind: 'fuel-tank' as const }));
            const g = createGameModel({ sections: [{ ...makeSection(100), spawns }] });
            g.playerInput.bombPressed = true;
            for (let i = 0; i < 120; i++) g.update(1000 / 60);
            expect(g.enemiesDestroyed).toBe(1);
            expect(g.fuelTanksDestroyed).toBe(1);
            expect(g.basesDestroyed).toBe(0);
        });

        it('counts the base destroyed by a bomb as a base, not as an enemy', () => {
            // A bomb dropped as the game starts lands at about column 9
            const g = createGameModel({ sections: [{ ...makeSection(100), spawns: [{ col: 9, row: 0, kind: 'base' }] }] });
            g.playerInput.bombPressed = true;
            for (let i = 0; i < 120; i++) g.update(1000 / 60);
            expect(g.isBaseAlive).toBe(false);
            expect(g.basesDestroyed).toBe(1);
            expect(g.enemiesDestroyed).toBe(0);
            expect(g.fuelTanksDestroyed).toBe(0);
        });

        it('does not count an enemy the ship crashes into, since the crash has a sound of its own', () => {
            const g = createGameModel({
                sections: [{ ...makeSection(100), spawns: [{ col: SHIP_START_COL + 2, row: SHIP_START_ROW, kind: 'ufo' }] }],
            });
            for (let i = 0; i < 60; i++) g.update(1000 / 60);
            expect(g.phase).toBe('dying');
            expect(g.enemiesDestroyed).toBe(0);
        });

        it('starts a new game on the tick after a restart, so each count rises from 0 in a later tick', () => {
            const g = createGameModel({
                sections: [{ ...makeSection(100), spawns: [{ col: SHIP_START_COL + ROCKET_DETECT_RANGE / 2, row: 0, kind: 'rocket' }] }],
            });
            g.update(16);
            expect(g.rocketsLaunched).toBe(1);
            // The fuel runs out for each ship in turn
            for (let i = 0; i < 10000 && g.phase !== 'game-over'; i++) g.update(100);
            expect(g.phase).toBe('game-over');
            g.playerInput.restartPressed = true;
            g.update(16);
            expect(g.phase).toBe('playing');
            expect(g.scrollCol).toBe(0);
            expect(g.rocketsLaunched).toBe(0);
            g.update(16);
            expect(g.rocketsLaunched).toBe(1);
        });
    });

    describe('terrain collision', () => {
        it('ship dies when hitting solid terrain', () => {
            // Create terrain with floor at row 2 (very high floor - rows 12,13 solid)
            // Then move ship into solid area
            const section: SectionProfile = {
                floor: new Array(100).fill(13), // almost fully solid
                ceiling: new Array(100).fill(0),
                spawns: [],
            };
            const g = createGameModel({ sections: [section] });
            // Ship starts at row 7 which is now solid (14-13=1, so rows 1-13 solid)
            g.update(16);
            expect(g.phase).toBe('dying');
        });
    });

    describe('spawning with real sections', () => {
        it('spawns enemies as scroll reaches spawn points', () => {
            const g = createGameModel({ sections: SECTIONS });
            // Advance far enough that spawn cursor should activate some entities
            // Spawns at cols ~10-90 in section 1, spawn edge = scrollCol + 28 + 2
            for (let i = 0; i < 100; i++) g.update(100); // 10 seconds of scroll at speed 3 -> scrollCol ~30
            // At least some rockets or UFOs should be active by now
            expect(g.rockets.liveCount + g.ufos.liveCount + g.fuelTanks.liveCount).toBeGreaterThan(0);
        });
    });

    describe('rockets', () => {
        it('removes a launched rocket once it flies off the top', () => {
            const section: SectionProfile = {
                ...makeSection(100),
                spawns: [{ col: 10, row: 0, kind: 'rocket' }],
            };
            const g = createGameModel({ sections: [section] });
            g.update(16); // spawn; ship is within detect range so it launches
            expect(g.rockets.liveCount).toBe(1);
            for (let i = 0; i < 30; i++) g.update(100); // ~3s at launch speed 8 clears the top
            expect(g.rockets.liveCount).toBe(0);
        });
    });

    describe('fuel depletion', () => {
        it('fuel depletes during play', () => {
            const g = makeGame();
            const initialFuel = g.fuel.fuel;
            // Advance 10 seconds
            for (let i = 0; i < 100; i++) g.update(100);
            expect(g.fuel.fuel).toBeLessThan(initialFuel);
        });
    });

    describe('reset', () => {
        it('resets to initial state', () => {
            const g = makeGame();
            for (let i = 0; i < 50; i++) g.update(100);
            g.reset();
            expect(g.phase).toBe('playing');
            expect(g.scrollCol).toBe(0);
            expect(g.score).toBe(0);
            expect(g.ship.isAlive).toBe(true);
        });
    });
});
