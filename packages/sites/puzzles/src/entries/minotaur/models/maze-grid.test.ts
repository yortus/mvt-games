import { describe, expect, it } from 'vitest';
import { createMazeGrid } from './maze-grid';

// Corners are numbered row by row, COLS + 1 to a row, so the corner at the top right of cell (row, col) is
// row * (COLS + 1) + col + 1.

const ROWS = 4;
const COLS = 5;
const grid = createMazeGrid({ rows: ROWS, cols: COLS });
const corner = (row: number, col: number): number => row * (COLS + 1) + col;
const cell = (row: number, col: number): number => row * COLS + col;

describe('MazeGrid', () => {
    it('finds the edge along a line between columns, from a corner to the one below it, either way', () => {
        expect(grid.edgeAlong(corner(1, 2), corner(2, 2))).toBe(grid.edgeBetween(cell(1, 1), cell(1, 2)));
        expect(grid.edgeAlong(corner(2, 2), corner(1, 2))).toBe(grid.edgeBetween(cell(1, 1), cell(1, 2)));
    });

    it('finds the edge along a line between rows, from a corner to the one beside it', () => {
        expect(grid.edgeAlong(corner(3, 0), corner(3, 1))).toBe(grid.edgeBetween(cell(2, 0), cell(3, 0)));
    });

    it('finds no edge along the border, or between corners that are not next to each other', () => {
        expect(grid.edgeAlong(corner(0, 1), corner(0, 2))).toBe(-1);
        expect(grid.edgeAlong(corner(1, 0), corner(2, 0))).toBe(-1);
        expect(grid.edgeAlong(corner(ROWS, 2), corner(ROWS, 3))).toBe(-1);
        expect(grid.edgeAlong(corner(1, COLS), corner(2, COLS))).toBe(-1);
        // The last corner of one row and the first of the next
        expect(grid.edgeAlong(corner(1, COLS), corner(2, 0))).toBe(-1);
        expect(grid.edgeAlong(corner(1, 1), corner(2, 2))).toBe(-1);
    });
});
