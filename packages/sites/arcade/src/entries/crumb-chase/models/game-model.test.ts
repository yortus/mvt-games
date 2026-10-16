import { describe, expect, it } from 'vitest';
import { CAT_SPAWNS, MAZE_DATA, MOUSE_SPAWN, PEN_EXIT } from '../data';
import { createGameModel, type GameModel } from './game-model';

describe('GameModel', () => {
    describe('the cats', () => {
        it('leave their pen one at a time', () => {
            const model = makeGame();
            const releaseTimes = CAT_SPAWNS.map(() => -1);
            for (let t = 0; t < 20_000 && model.phase === 'playing'; t += STEP_MS) {
                // The mouse stays out of reach, so the game runs on
                model.playerInput.direction = 'left';
                model.update(STEP_MS);
                for (let i = 0; i < model.cats.length; i++) {
                    if (releaseTimes[i] < 0 && model.cats[i].releaseInMs === 0) releaseTimes[i] = t;
                }
            }
            expect(new Set(releaseTimes).size).toBe(CAT_SPAWNS.length);
            expect([...releaseTimes].sort((a, b) => a - b)).toEqual(releaseTimes);
        });

        it('scatter as a game starts, then chase', () => {
            const model = makeGame();
            expect(model.catMode).toBe('scatter');
            let hasChased = false;
            for (let t = 0; t < 30_000 && !hasChased; t += STEP_MS) {
                model.update(STEP_MS);
                hasChased = model.catMode === 'chase';
            }
            expect(hasChased).toBe(true);
        });
    });

    describe('saving', () => {
        it('loads a game it saved, as it was', () => {
            const model = makeGame();
            for (let t = 0; t < 3000 && model.phase === 'playing'; t += STEP_MS) model.update(STEP_MS);
            const saved = model.save();
            expect(saved).toBeDefined();

            const loaded = makeGame();
            expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
            expect(loaded.score).toBe(model.score);
            expect(loaded.catMode).toBe(model.catMode);
            expect(loaded.maze.remainingCrumbs).toBe(model.maze.remainingCrumbs);
            expect(loaded.mouse.row).toBe(Math.round(model.mouse.row));
            expect(loaded.mouse.col).toBe(Math.round(model.mouse.col));
            expect(loaded.mouse.direction).toBe(model.mouse.direction);
            for (let i = 0; i < model.cats.length; i++) {
                expect(loaded.cats[i].row).toBe(Math.round(model.cats[i].row));
                expect(loaded.cats[i].releaseInMs).toBe(model.cats[i].releaseInMs);
            }
            // And plays on from there
            loaded.update(STEP_MS);
            expect(loaded.phase).toBe('playing');
        });

        it('saves nothing until the first crumb is eaten, since resuming would only start the game again', () => {
            const model = makeGame();
            expect(model.save()).toBeUndefined();
            for (let t = 0; t < 3000 && model.score === 0; t += STEP_MS) model.update(STEP_MS);
            expect(model.score).toBeGreaterThan(0);
            expect(model.save()).toBeDefined();
        });

        it('saves nothing once the game is over', () => {
            const model = makeGame();
            for (let t = 0; t < 120_000 && model.phase === 'playing'; t += STEP_MS) model.update(STEP_MS);
            expect(model.phase).not.toBe('playing');
            expect(model.save()).toBeUndefined();
        });

        it('loads nothing that is not a saved game of its maze, and plays on as it was', () => {
            // A save from a game that has eaten a crumb, to spoil in each way below
            const played = makeGame();
            for (let t = 0; t < 3000 && played.score === 0; t += STEP_MS) played.update(STEP_MS);
            const saved = played.save();
            expect(saved).toBeDefined();
            const model = makeGame();
            const otherVersion = { ...saved, version: 0 };
            const mouseInHedge = { ...saved, mouse: { row: 0, col: 0, direction: 'left' } };
            const tooFewCats = { ...saved, cats: saved?.cats.slice(1) };
            const eatenHedge = { ...saved, eaten: [0] };
            const rejects: unknown[] = [undefined, 'saved', otherVersion, mouseInHedge, tooFewCats, eatenHedge];
            for (let i = 0; i < rejects.length; i++) {
                expect(model.load(rejects[i]), `save ${i}`).toBe(false);
            }
            expect(model.mouse.row).toBe(MOUSE_SPAWN[0]);
            expect(model.mouse.col).toBe(MOUSE_SPAWN[1]);
        });
    });
});

const STEP_MS = 16;

function makeGame(): GameModel {
    return createGameModel({ grid: MAZE_DATA, mouseSpawn: MOUSE_SPAWN, catSpawns: CAT_SPAWNS, penExit: PEN_EXIT });
}
