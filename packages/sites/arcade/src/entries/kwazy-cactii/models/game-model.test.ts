import { describe, expect, it } from 'vitest';
import { GRID_COLS, GRID_ROWS } from '../data';
import type { CactusCell, CactusKind } from './common';
import { createGameModel, type GameModel } from './game-model';
import { wouldMatchAfterSwap } from './grid-helpers';

describe('GameModel', () => {
    it('drops a new game asked for during play, and plays on', () => {
        const model = createGameModel();
        playSwaps(model, 1);
        const board = model.board;
        const score = model.score;
        model.startNewRun();
        model.update(STEP_MS);
        expect(model.board).toBe(board);
        expect(model.score).toBe(score);
    });

    describe('saving', () => {
        it('loads a game it saved, as it was', () => {
            const model = createGameModel();
            playSwaps(model, 3);
            const saved = model.save();
            expect(saved).toBeDefined();

            const loaded = createGameModel();
            expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
            expect(loaded.score).toBe(model.score);
            expect(loaded.board.phase).toBe('idle');
            expect(kindsOf(loaded)).toEqual(kindsOf(model));
        });

        it('saves nothing until the first line is made, since resuming would only start the game again', () => {
            const model = createGameModel();
            expect(model.save()).toBeUndefined();
            playSwaps(model, 1);
            expect(model.score).toBeGreaterThan(0);
            expect(model.save()).toBeDefined();
        });

        it('saves the board as it stood before a swap that is playing out', () => {
            const model = createGameModel();
            playSwaps(model, 1);
            const before = kindsOf(model);
            const scoreBefore = model.score;
            const pair = findMatchingSwap(model);
            expect(pair).toBeDefined();
            expect(model.trySwap(pair![0], pair![1])).toBe(true);
            model.update(STEP_MS);
            expect(model.board.phase).not.toBe('idle');

            const saved = model.save();
            expect(saved?.kinds).toEqual(before);
            expect(saved?.score).toBe(scoreBefore);
        });

        it('loads nothing that is not a board of its size at rest, and plays on as it was', () => {
            const model = createGameModel();
            playSwaps(model, 1);
            const before = kindsOf(model);
            const saved = model.save()!;
            const otherVersion = { ...saved, version: 0 };
            const tooFewRows = { ...saved, kinds: saved.kinds.slice(1) };
            const unknownKind = { ...saved, kinds: [['saguaro', ...saved.kinds[0].slice(1)], ...saved.kinds.slice(1)] };
            const negativeScore = { ...saved, score: -10 };
            // Three of a kind at the start of the top row make a line
            const firstKind = saved.kinds[0][0];
            const withLine = { ...saved, kinds: [[firstKind, firstKind, firstKind, ...saved.kinds[0].slice(3)], ...saved.kinds.slice(1)] };
            const rejects: unknown[] = [undefined, 'saved', otherVersion, tooFewRows, unknownKind, negativeScore, withLine];
            for (let i = 0; i < rejects.length; i++) {
                expect(model.load(rejects[i]), `save ${i}`).toBe(false);
            }
            expect(kindsOf(model)).toEqual(before);
        });
    });
});

const STEP_MS = 16;

/** Makes `count` swaps that each make a line, letting each come to rest. */
function playSwaps(model: GameModel, count: number): void {
    for (let i = 0; i < count; i++) {
        const pair = findMatchingSwap(model);
        if (pair === undefined) return;
        model.trySwap(pair[0], pair[1]);
        for (let t = 0; t < 10_000 && model.board.phase !== 'idle'; t += STEP_MS) model.update(STEP_MS);
    }
}

function findMatchingSwap(model: GameModel): [CactusCell, CactusCell] | undefined {
    const { cells } = model.board;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS - 1; c++) {
            if (wouldMatchAfterSwap(cells, GRID_ROWS, GRID_COLS, r, c, r, c + 1)) return [cells[r][c], cells[r][c + 1]];
        }
    }
    for (let r = 0; r < GRID_ROWS - 1; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (wouldMatchAfterSwap(cells, GRID_ROWS, GRID_COLS, r, c, r + 1, c)) return [cells[r][c], cells[r + 1][c]];
        }
    }
    return undefined;
}

function kindsOf(model: GameModel): CactusKind[][] {
    return model.board.cells.map((row) => row.map((cell) => cell.kind));
}
