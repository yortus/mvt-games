import { describe, expect, it } from 'vitest';
import { movedPosition, type WallMoveKind, wallMoveFor } from './card-wall-keys';

describe('moving across the card wall', () => {
    it('takes the arrows, and W, A, S and D', () => {
        expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map(wallMoveFor)).toEqual(['left', 'right', 'up', 'down']);
        expect(['a', 'd', 'w', 's', 'W'].map(wallMoveFor)).toEqual(['left', 'right', 'up', 'down', 'up']);
        expect(wallMoveFor('i')).toBeUndefined();
    });

    // Seven cards, three to a row:
    //   0 1 2
    //   3 4 5
    //   6
    const move = (position: number, kind: WallMoveKind): number => movedPosition({ position, move: kind, shownCount: 7, columnCount: 3 });

    it('steps left and right through the order shown, across rows, stopping at the ends', () => {
        expect(move(2, 'right')).toBe(3);
        expect(move(3, 'left')).toBe(2);
        expect(move(0, 'left')).toBe(0);
        expect(move(6, 'right')).toBe(6);
    });

    it('steps up and down a column, stopping at the top and bottom', () => {
        expect(move(4, 'up')).toBe(1);
        expect(move(1, 'up')).toBe(1);
        expect(move(0, 'down')).toBe(3);
        expect(move(3, 'down')).toBe(6);
        expect(move(6, 'down')).toBe(6);
    });

    it('goes down to the last card when the row below is too short to reach', () => {
        expect(move(5, 'down')).toBe(6);
    });

    it('has nowhere to go on an empty wall', () => {
        expect(movedPosition({ position: 0, move: 'right', shownCount: 0, columnCount: 3 })).toBe(-1);
    });
});
