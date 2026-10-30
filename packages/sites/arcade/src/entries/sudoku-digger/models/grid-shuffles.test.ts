import { describe, expect, it } from 'vitest';
import { swapColumns, swapDigits, swapStacks, turnGrid } from './grid-shuffles';
import { FULL_GRID, isValidGrid } from './test-grids.test-support';

describe('the grid shuffles', () => {
    it('swap two digits everywhere, keeping the grid valid', () => {
        const grid = new Uint8Array(FULL_GRID);
        swapDigits(grid, 3, 7);
        expect(isValidGrid(grid)).toBe(true);
        for (let cell = 0; cell < 81; cell++) {
            const expected = FULL_GRID[cell] === 3 ? 7 : FULL_GRID[cell] === 7 ? 3 : FULL_GRID[cell];
            expect(grid[cell]).toBe(expected);
        }
    });

    it('swap two columns of a stack, keeping the grid valid', () => {
        const grid = new Uint8Array(FULL_GRID);
        swapColumns(grid, 3, 5);
        expect(isValidGrid(grid)).toBe(true);
        expect(grid[9 * 4 + 3]).toBe(FULL_GRID[9 * 4 + 5]);
        expect(grid[9 * 4 + 5]).toBe(FULL_GRID[9 * 4 + 3]);
    });

    it('swap two stacks, keeping the grid valid', () => {
        const grid = new Uint8Array(FULL_GRID);
        swapStacks(grid, 0, 2);
        expect(isValidGrid(grid)).toBe(true);
        expect(grid[1]).toBe(FULL_GRID[7]);
    });

    it('turn a quarter turn clockwise, so the left column becomes the top row, and four turns go full circle', () => {
        const grid = new Uint8Array(FULL_GRID);
        const scratch = new Uint8Array(81);
        turnGrid(grid, scratch);
        expect(isValidGrid(grid)).toBe(true);
        // The top row, read left to right, is the left column read upwards
        for (let column = 0; column < 9; column++) expect(grid[column]).toBe(FULL_GRID[(8 - column) * 9]);
        turnGrid(grid, scratch);
        turnGrid(grid, scratch);
        turnGrid(grid, scratch);
        expect([...grid]).toEqual([...FULL_GRID]);
    });
});
