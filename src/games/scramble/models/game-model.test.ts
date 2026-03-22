import { describe, it, expect } from 'vitest';
import { createGameModel } from './game-model';
import type { SectionProfile } from '../data';
import { SECTIONS, SCROLL_SPEED } from '../data';

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

        it('has correct pool sizes', () => {
            const g = makeGame();
            expect(g.bullets.length).toBe(4);
            expect(g.bombs.length).toBe(2);
            expect(g.rockets.length).toBe(8);
            expect(g.ufos.length).toBe(6);
            expect(g.fuelTanks.length).toBe(6);
            expect(g.explosions.length).toBe(8);
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
            const activeBullets = g.bullets.filter((b) => b.isActive);
            expect(activeBullets.length).toBe(1);
        });

        it('does not fire more than one bullet per press', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.update(16);
            g.update(16); // same press held
            const activeBullets = g.bullets.filter((b) => b.isActive);
            expect(activeBullets.length).toBe(1);
        });

        it('fires another bullet after releasing and pressing again', () => {
            const g = makeGame();
            g.playerInput.firePressed = true;
            g.update(16);
            g.playerInput.firePressed = false;
            g.update(16);
            g.playerInput.firePressed = true;
            g.update(16);
            const activeBullets = g.bullets.filter((b) => b.isActive);
            expect(activeBullets.length).toBe(2);
        });

        it('drops a bomb on bomb press', () => {
            const g = makeGame();
            g.playerInput.bombPressed = true;
            g.update(16);
            const activeBombs = g.bombs.filter((b) => b.isActive);
            expect(activeBombs.length).toBe(1);
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
            const activeRockets = g.rockets.filter((r) => r.isActive);
            const activeUfos = g.ufos.filter((u) => u.isActive);
            const activeFuel = g.fuelTanks.filter((f) => f.isActive);
            expect(activeRockets.length + activeUfos.length + activeFuel.length).toBeGreaterThan(0);
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
