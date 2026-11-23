import { describe, expect, it } from 'vitest';
import { createMarginGameModel, type MarginGameModel } from './margin-game-model';

describe('the margin game', () => {
    it('has the other player mark after a moment\'s thought, and lets the reader mark only on their turn', () => {
        const game = createMarginGameModel({ seed: 1 });
        game.markCell(4);
        expect(game.isReadersTurn).toBe(false);
        game.markCell(0);
        expect(game.markAt(0)).toBe('none');
        think(game);
        expect(countOf(game, 'nought')).toBe(1);
        expect(game.isReadersTurn).toBe(true);
    });

    it('usually blocks a line the reader is about to make', () => {
        // Over many seeds, the reader takes two corners of a row, and the other player mostly takes its middle
        let blocks = 0;
        for (let seed = 0; seed < 40; seed++) {
            const game = createMarginGameModel({ seed });
            game.markCell(0);
            think(game);
            if (game.markAt(2) !== 'none') continue;
            game.markCell(2);
            think(game);
            if (game.markAt(1) === 'nought') blocks++;
        }
        expect(blocks).toBeGreaterThan(20);
    });

    it('ends a game the reader wins, rubs the game out after a moment, and has the other player go first in the next', () => {
        // A seed whose other player lets the reader win down the left column, found by trying
        const game = findGameTheReaderWins();
        expect(game.outcome).toBe('reader-won');
        expect(game.winningLine).toBeDefined();
        for (let i = 0; i < 200 && game.gamesRubbedOut === 0; i++) game.update(16);
        expect(game.gamesRubbedOut).toBe(1);
        expect(countOf(game, 'cross')).toBe(0);
        think(game);
        expect(countOf(game, 'nought')).toBe(1);
    });
});

/** Lets the other player think, long enough to mark. */
function think(game: MarginGameModel): void {
    for (let i = 0; i < 120 && !game.isReadersTurn && game.outcome === 'playing'; i++) game.update(16);
}

function countOf(game: MarginGameModel, mark: 'cross' | 'nought'): number {
    let count = 0;
    for (let cell = 0; cell < 9; cell++) if (game.markAt(cell) === mark) count++;
    return count;
}

/** Plays down the left column, against one seed after another, until the other player fails to block it. */
function findGameTheReaderWins(): MarginGameModel {
    for (let seed = 0; seed < 200; seed++) {
        const game = createMarginGameModel({ seed });
        for (const cell of [0, 3, 6]) {
            if (game.markAt(cell) !== 'none' || game.outcome !== 'playing') break;
            game.markCell(cell);
            think(game);
        }
        if (game.outcome === 'reader-won') return game;
    }
    throw new Error('no seed lets the reader win down the left column');
}
