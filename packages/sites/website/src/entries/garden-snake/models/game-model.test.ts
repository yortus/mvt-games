import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLS, ROWS } from '../data';
import { createGameModel, type GameModel } from './game-model';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the garden snake game', () => {
    it('grows by one, and scores, for a berry it eats', () => {
        // The first berry lands in the middle of the garden, straight ahead of the snake
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);
        const model = createGameModel();
        const length = model.length;
        stepUntil(model, () => model.score > 0);
        expect(model.length).toBe(length + 1);
        expect(model.rowAt(0)).toBe(ROWS / 2);
    });

    it('does not double back on itself', () => {
        const model = createGameModel();
        const col = model.colAt(0);
        model.direction = 'left';
        stepUntil(model, () => model.colAt(0) >= col + 1);
        expect(model.phase).toBe('playing');
    });

    it('turns at the next cell it reaches, not the one it has just left', () => {
        const model = createGameModel();
        const col = model.colAt(0);
        // Steer down halfway between two cells
        stepUntil(model, () => model.colAt(0) >= col + 0.5);
        model.direction = 'down';
        stepUntil(model, () => model.rowAt(0) > ROWS / 2);
        expect(model.colAt(0)).toBe(col + 1);
        for (let i = 1; i < model.length; i++) expect(model.colAt(i)).toBeLessThanOrEqual(col + 1);
    });

    it('ends at the fence, and starts again when restart is pressed', () => {
        // The berry lands in the top left corner, out of the way
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const model = createGameModel();
        stepUntil(model, () => model.phase === 'game-over');
        expect(model.colAt(0)).toBe(COLS - 1);

        model.restartPressed = true;
        model.update(16);
        expect(model.phase).toBe('playing');
        expect(model.score).toBe(0);
    });
});

/** Advances the model a frame at a time until `isDone`, failing after a minute of game time. */
function stepUntil(model: GameModel, isDone: () => boolean): void {
    for (let ms = 0; ms < 60_000; ms += 16) {
        if (isDone()) return;
        model.update(16);
    }
    throw new Error('Gave up after a minute of game time.');
}
