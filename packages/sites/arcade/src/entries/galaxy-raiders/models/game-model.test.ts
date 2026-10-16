import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WAVES } from '../data';
import { createGameModel, type GameModel, type SavedGame } from './game-model';

describe('GameModel', () => {
    it('counts the raiders still alive in this wave', () => {
        const model = createGameModel({ waves: WAVES });
        const waveSize = WAVES[0].slots.length;
        expect(model.enemiesLeft).toBe(waveSize);
        model.enemies[0].kill();
        expect(model.enemiesLeft).toBe(waveSize - 1);
        for (const enemy of model.enemies) enemy.kill();
        expect(model.enemiesLeft).toBe(0);
    });
});

describe('GameModel: saving', () => {
    // Seed the random numbers, so the raiders dive and fire the same way on every run
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

    it('saves nothing while the game is still at its start', () => {
        const model = createGameModel({ waves: WAVES });
        expect(model.save()).toBeUndefined();
        playUntilScored(model);
        expect(model.phase).toBe('playing');
        expect(model.save()).toBeUndefined();
    });

    it('saves a stage part way through as of its start, with the score it had then', () => {
        const saved = saveAtSecondStage();
        const model = createGameModel({ waves: WAVES });
        expect(model.load(saved)).toBe(true);
        playUntilScored(model);
        expect(model.score).toBeGreaterThan(saved.score);
        expect(model.save()).toEqual(saved);
    });

    it('saves a stage just cleared as the start of the next, and loads it there', () => {
        const model = createGameModel({ waves: WAVES });
        playUntilScored(model);
        clearStage(model);
        expect(model.phase).toBe('stage-clear');
        const saved = model.save();
        expect(saved).toMatchObject({ stage: 2, score: model.score, lives: model.lives });

        const loaded = createGameModel({ waves: WAVES });
        expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
        expect(loaded.phase).toBe('playing');
        expect(loaded.stage).toBe(2);
        expect(loaded.score).toBe(model.score);
        expect(loaded.lives).toBe(model.lives);
        expect(loaded.enemiesLeft).toBe(WAVES[1].slots.length);
    });

    it('keeps a life lost, from the moment the ship is hit', () => {
        const stageStart = saveAtSecondStage();
        const model = createGameModel({ waves: WAVES });
        expect(model.load(stageStart)).toBe(true);
        const startLives = model.lives;
        playUntil(model, () => model.phase === 'dying', false);
        expect(model.phase).toBe('dying');
        const saved = model.save();
        expect(saved).toEqual({ ...stageStart, lives: startLives - 1 });

        playUntil(model, () => model.phase !== 'dying', false);
        expect(model.lives).toBe(startLives - 1);
        expect(model.save()).toEqual(saved);

        const loaded = createGameModel({ waves: WAVES });
        expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
        expect(loaded.phase).toBe('playing');
        expect(loaded.lives).toBe(startLives - 1);
    });

    it('loads a stage past the last wave, which plays the last wave again', () => {
        const model = createGameModel({ waves: WAVES });
        const stage = WAVES.length + 2;
        expect(model.load({ ...saveAtSecondStage(), stage })).toBe(true);
        expect(model.stage).toBe(stage);
        expect(model.enemiesLeft).toBe(WAVES[WAVES.length - 1].slots.length);
    });

    it('loads nothing that is not a saved game, and plays on as it was', () => {
        const saved = saveAtSecondStage();
        const model = createGameModel({ waves: WAVES });
        playUntilScored(model);
        const score = model.score;
        const enemiesLeft = model.enemiesLeft;
        const lives = model.lives;
        const mostLives = createGameModel({ waves: WAVES }).lives;
        const rejects: unknown[] = [
            undefined,
            'saved',
            { ...saved, version: 0 },
            { ...saved, stage: 0 },
            { ...saved, score: 1.5 },
            { ...saved, score: -1 },
            { ...saved, lives: 0 },
            { ...saved, lives: mostLives + 1 },
        ];
        for (let i = 0; i < rejects.length; i++) {
            expect(model.load(rejects[i]), `save ${i}`).toBe(false);
        }
        expect(model.stage).toBe(1);
        expect(model.score).toBe(score);
        expect(model.lives).toBe(lives);
        expect(model.enemiesLeft).toBe(enemiesLeft);
    });

    it('saves nothing once the game is over', () => {
        const model = createGameModel({ waves: WAVES });
        playUntil(model, () => model.phase === 'game-over', false);
        expect(model.phase).toBe('game-over');
        expect(model.save()).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ticks the game until `isDone`, firing in bursts if `isFiring`, or for a few minutes at most. */
function playUntil(model: GameModel, isDone: () => boolean, isFiring: boolean): void {
    for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && !isDone(); i++) {
        model.playerInput.firePressed = isFiring && i % 8 < 4;
        model.update(TICK_MS);
    }
    model.playerInput.firePressed = false;
}

/** Fires from where the ship starts until a raider is shot. */
function playUntilScored(model: GameModel): void {
    const score = model.score;
    playUntil(model, () => model.score > score && model.phase === 'playing', true);
}

/** Returns the save of a game that has just cleared its first stage, with some score: the start of the second. */
function saveAtSecondStage(): SavedGame {
    const model = createGameModel({ waves: WAVES });
    playUntilScored(model);
    clearStage(model);
    const saved = model.save();
    if (saved === undefined) throw new Error('A stage just cleared should save.');
    return saved;
}

/** Destroys the raiders left, and ticks once, so the game sees the stage cleared. */
function clearStage(model: GameModel): void {
    for (let i = 0; i < model.enemies.length; i++) model.enemies[i].kill();
    model.update(TICK_MS);
}

const TICK_MS = 1000 / 60;
const LONGEST_RUN_MS = 5 * 60 * 1000;
