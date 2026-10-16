import { describe, expect, it } from 'vitest';
import { createTileMove } from './tile-move';

describe('TileMove', () => {
    it('is idle until started', () => {
        const move = createTileMove();
        const position = { row: 1, col: 1 };
        expect(move.isMoving).toBe(false);
        expect(move.advance(position, 100)).toBe(false);
        expect(position).toEqual({ row: 1, col: 1 });
    });

    it('slides the position linearly towards the target', () => {
        const move = createTileMove();
        const position = { row: 2, col: 3 };
        move.start(position, 2, 4, 100);

        expect(move.advance(position, 25)).toBe(false);
        expect(position.col).toBeCloseTo(3.25);
        expect(move.advance(position, 25)).toBe(false);
        expect(position.col).toBeCloseTo(3.5);
        expect(position.row).toBe(2);
        expect(move.isMoving).toBe(true);
    });

    it('arrives exactly on the target, and drops the time past it', () => {
        const move = createTileMove();
        const position = { row: 0, col: 0 };
        move.start(position, 1, 0, 100);

        expect(move.advance(position, 150)).toBe(true);
        expect(position).toEqual({ row: 1, col: 0 });
        expect(move.isMoving).toBe(false);

        // The next move starts from scratch, with nothing carried over.
        move.start(position, 2, 0, 100);
        move.advance(position, 50);
        expect(position.row).toBeCloseTo(1.5);
    });

    it('starts from wherever the position is, even between tiles', () => {
        const move = createTileMove();
        const position = { row: 5, col: 2.4 };
        move.start(position, 5, 2, 40);
        move.advance(position, 20);
        expect(position.col).toBeCloseTo(2.2);
    });

    it('leaves the position where it is when stopped', () => {
        const move = createTileMove();
        const position = { row: 0, col: 0 };
        move.start(position, 0, 1, 100);
        move.advance(position, 30);
        move.stop();

        expect(move.isMoving).toBe(false);
        expect(move.advance(position, 100)).toBe(false);
        expect(position.col).toBeCloseTo(0.3);
    });
});
