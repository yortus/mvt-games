import { describe, it, expect } from 'vitest';
import { createGameModel, type GameModel, type SavedGame } from './game-model';
import type { SectionProfile } from '../data';
import { SECTIONS, VISIBLE_ROWS } from '../data';
import {
    INITIAL_LIVES,
    MAX_FUEL_TANKS,
    RESPAWN_FUEL_AMOUNT,
    ROCKET_DETECT_RANGE,
    SCORE_FUEL_TANK,
    SCROLL_SPEED,
    SHIP_START_COL,
    SHIP_START_ROW,
    SPEED_INCREASE_PER_LOOP,
} from './model-constants';

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
        it('fires a bullet when asked', () => {
            const g = makeGame();
            g.fire();
            g.update(16);
            expect(g.bullets.liveCount).toBe(1);
        });

        it('fires one bullet however many times it is asked between two updates, and none in the updates after', () => {
            const g = makeGame();
            g.fire();
            g.fire();
            g.update(16);
            g.update(16);
            expect(g.bullets.liveCount).toBe(1);
        });

        it('fires another bullet when asked again', () => {
            const g = makeGame();
            g.fire();
            g.update(16);
            g.update(16);
            g.fire();
            g.update(16);
            expect(g.bullets.liveCount).toBe(2);
        });

        it('drops a bomb when asked', () => {
            const g = makeGame();
            g.dropBomb();
            g.update(16);
            expect(g.bombs.liveCount).toBe(1);
        });
    });

    describe('what it keeps for the views to hear', () => {
        it('counts shots fired and bombs dropped, and starts again at 0 with a new game', () => {
            const g = makeGame();
            g.fire();
            g.dropBomb();
            g.update(16);
            g.update(16);
            g.fire();
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
            g.dropBomb();
            for (let i = 0; i < 120; i++) g.update(1000 / 60);
            expect(g.enemiesDestroyed).toBe(1);
            expect(g.fuelTanksDestroyed).toBe(1);
            expect(g.basesDestroyed).toBe(0);
        });

        it('counts the base destroyed by a bomb as a base, not as an enemy', () => {
            // A bomb dropped as the game starts lands at about column 9
            const g = createGameModel({ sections: [{ ...makeSection(100), spawns: [{ col: 9, row: 0, kind: 'base' }] }] });
            g.dropBomb();
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
            g.startNewRun();
            g.update(16);
            expect(g.phase).toBe('playing');
            expect(g.scrollCol).toBe(0);
            expect(g.rocketsLaunched).toBe(0);
            g.update(16);
            expect(g.rocketsLaunched).toBe(1);
        });

        it('drops a new game asked for before the game is over, rather than starting it once the game ends', () => {
            const g = makeGame();
            g.startNewRun();
            for (let i = 0; i < 10000 && g.phase !== 'game-over'; i++) g.update(100);
            expect(g.phase).toBe('game-over');
            g.update(16);
            expect(g.phase).toBe('game-over');
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

    describe('saving', () => {
        it('saves nothing in the first section of a new game, even once it has points, since a restart is as good', () => {
            const g = createGameModel({ sections: makeTankSections() });
            expect(g.save()).toBeUndefined();
            g.dropBomb();
            runFor(g, 2000);
            expect(g.score).toBe(SCORE_FUEL_TANK);
            expect(g.save()).toBeUndefined();
        });

        it('saves a section just reached as its start, with no more fuel than it had then, and loads it there', () => {
            const sections = makeTankSections();
            const g = createGameModel({ sections });
            playToSecondSection(g);
            const sectionStartScore = g.score;
            const sectionStartFuel = g.fuel.fuel;

            // A bomb on the section's tanks wins points and fuel, which a save does not keep
            g.dropBomb();
            runFor(g, 2000);
            expect(g.score).toBe(sectionStartScore + SCORE_FUEL_TANK);
            const saved = g.save();
            expect(saved).toMatchObject({ loop: 0, section: 1, score: sectionStartScore, lives: INITIAL_LIVES });
            expect(saved?.fuel).toBeCloseTo(sectionStartFuel, 2);
            expect(saved?.fuel).toBeLessThan(g.fuel.fuel);

            const loaded = createGameModel({ sections });
            expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
            expect(loaded.phase).toBe('playing');
            expect(loaded.sectionIndex).toBe(1);
            expect(loaded.scrollCol).toBe(sections[0].floor.length);
            expect(loaded.ship.worldCol).toBe(loaded.scrollCol + SHIP_START_COL);
            expect(loaded.score).toBe(sectionStartScore);
            expect(loaded.lives).toBe(INITIAL_LIVES);
            expect(loaded.fuel.fuel).toBe(saved?.fuel);
            // The section's own tanks are met again, and the tanks before it are not
            loaded.update(TICK_MS);
            expect(loaded.fuelTanks.liveCount).toBe(MAX_FUEL_TANKS);
        });

        it('saves a loop just cleared as the start of the next, and loads it there', () => {
            const sections = makeTankSections();
            const g = createGameModel({ sections });
            for (let i = 0; i < LONGEST_RUN_TICKS && g.phase === 'playing'; i++) g.update(TICK_MS);
            expect(g.phase).toBe('section-clear');
            const saved = g.save();
            expect(saved).toMatchObject({ loop: 1, section: 0, score: g.score, lives: g.lives, fuel: g.fuel.fuel });

            const loaded = createGameModel({ sections });
            expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
            expect(loaded.phase).toBe('playing');
            expect(loaded.loop).toBe(1);
            expect(loaded.scrollSpeed).toBe(SCROLL_SPEED + SPEED_INCREASE_PER_LOOP);
            expect(loaded.scrollCol).toBe(0);

            // The game's own next loop starts in the same place
            for (let i = 0; i < LONGEST_RUN_TICKS && g.phase === 'section-clear'; i++) g.update(TICK_MS);
            expect(g.phase).toBe('playing');
            expect(g.loop).toBe(1);
            expect(g.scrollSpeed).toBe(loaded.scrollSpeed);
            expect(g.save()).toMatchObject({ loop: 1, section: 0, score: saved?.score, lives: saved?.lives });
        });

        it('counts a life lost as soon as the ship is hit, and saves nothing once the last is lost', () => {
            // Solid from floor to sky after the first section, so the ship is hit as soon as it appears
            const solid = makeSection(SECTION_COLS, VISIBLE_ROWS);
            const g = createGameModel({ sections: [makeTankSections()[0], solid, solid] });
            expect(g.load(saveAtSecondSection())).toBe(true);
            let deaths = 0;
            for (let i = 0; i < LONGEST_RUN_TICKS && g.phase !== 'game-over'; i++) {
                const wasDying = g.phase === 'dying';
                g.update(TICK_MS);
                if (g.phase === 'dying' && !wasDying) deaths++;
                if (g.phase === 'dying') expect(g.save()?.lives ?? 0).toBe(g.lives - 1);
                if (g.phase === 'respawning') expect(g.save()?.lives).toBe(g.lives);
            }
            expect(g.phase).toBe('game-over');
            expect(deaths).toBe(INITIAL_LIVES);
            expect(g.save()).toBeUndefined();
        });

        it('gives a ship that runs out of fuel the fuel that respawning gives it', () => {
            const g = createGameModel({ sections: [makeTankSections()[0], makeSection(SECTION_COLS * 10), makeSection(SECTION_COLS)] });
            expect(g.load(saveAtSecondSection())).toBe(true);
            for (let i = 0; i < LONGEST_RUN_TICKS && g.phase === 'playing'; i++) g.update(TICK_MS);
            expect(g.phase).toBe('dying');
            expect(g.fuel.isFuelEmpty).toBe(true);
            expect(g.save()).toMatchObject({ lives: INITIAL_LIVES - 1, fuel: RESPAWN_FUEL_AMOUNT });
            for (let i = 0; i < LONGEST_RUN_TICKS && g.phase === 'dying'; i++) g.update(TICK_MS);
            expect(g.phase).toBe('respawning');
            expect(g.save()).toMatchObject({ lives: INITIAL_LIVES - 1, fuel: RESPAWN_FUEL_AMOUNT });
        });

        it('loads nothing that is not a saved game of its sections, and plays on as it was', () => {
            const sections = makeTankSections();
            const g = createGameModel({ sections });
            runFor(g, 1000);
            const saved = saveAtSecondSection();
            const scrollCol = g.scrollCol;
            const fuel = g.fuel.fuel;
            const rejects: unknown[] = [
                undefined,
                'saved',
                { ...saved, version: 0 },
                { ...saved, loop: -1 },
                { ...saved, section: -1 },
                { ...saved, section: 0.5 },
                { ...saved, section: sections.length },
                { ...saved, score: 1.5 },
                { ...saved, lives: 0 },
                { ...saved, lives: INITIAL_LIVES + 1 },
                { ...saved, fuel: 0 },
                { ...saved, fuel: 1.5 },
                { ...saved, fuel: '1' },
            ];
            for (let i = 0; i < rejects.length; i++) {
                expect(g.load(rejects[i]), `save ${i}`).toBe(false);
            }
            expect(g.phase).toBe('playing');
            expect(g.scrollCol).toBe(scrollCol);
            expect(g.fuel.fuel).toBe(fuel);
            expect(g.lives).toBe(INITIAL_LIVES);
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 60;
const LONGEST_RUN_TICKS = 60 * 60 * 5;
const SECTION_COLS = 40;

/**
 * Three flat sections, each with a row of fuel tanks near its start, one in
 * each slot. A bomb dropped as the ship reaches a section lands on one.
 */
function makeTankSections(): SectionProfile[] {
    const spawns = Array.from({ length: MAX_FUEL_TANKS }, (_, i) => ({ col: 6 + i, row: 0, kind: 'fuel-tank' as const }));
    return [0, 1, 2].map(() => ({ ...makeSection(SECTION_COLS), spawns }));
}

/** Plays a game of `makeTankSections` into its second section, bombing a tank in the first on the way. */
function playToSecondSection(g: GameModel): void {
    g.dropBomb();
    for (let i = 0; i < LONGEST_RUN_TICKS && g.sectionIndex === 0; i++) g.update(TICK_MS);
    expect(g.sectionIndex).toBe(1);
    expect(g.score).toBe(SCORE_FUEL_TANK);
}

/** Returns the save of a game of `makeTankSections` that has just reached its second section. */
function saveAtSecondSection(): SavedGame | undefined {
    const g = createGameModel({ sections: makeTankSections() });
    playToSecondSection(g);
    return g.save();
}

function runFor(g: GameModel, durationMs: number): void {
    for (let elapsedMs = 0; elapsedMs < durationMs; elapsedMs += TICK_MS) g.update(TICK_MS);
}
