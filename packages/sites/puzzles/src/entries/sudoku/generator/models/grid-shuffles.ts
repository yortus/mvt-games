import { CELL_COUNT } from '../sudoku-grid';

// Ways to change a grid that keep it a valid Sudoku, and keep a puzzle just
// as hard: what the paper calls equivalent propagation. Each works in place,
// on any array with one entry for each cell, so a grid's digits and
// whatever else is kept for each cell move together.

// ---------------------------------------------------------------------------
// Shuffles
// ---------------------------------------------------------------------------

/** Swaps every `first` in `digits` for a `second`, and every `second` for a `first`. */
export function swapDigits(digits: Uint8Array, first: number, second: number): void {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (digits[cell] === first) digits[cell] = second;
        else if (digits[cell] === second) digits[cell] = first;
    }
}

/** Swaps two columns, from 0 to 8. Swapping two in the same stack of boxes keeps the grid valid. */
export function swapColumns(cells: Uint8Array, first: number, second: number): void {
    for (let row = 0; row < 9; row++) {
        const a = row * 9 + first;
        const b = row * 9 + second;
        const swap = cells[a];
        cells[a] = cells[b];
        cells[b] = swap;
    }
}

/** Swaps two stacks, each three columns of boxes wide, from 0 to 2. */
export function swapStacks(cells: Uint8Array, first: number, second: number): void {
    for (let i = 0; i < 3; i++) swapColumns(cells, first * 3 + i, second * 3 + i);
}

/** Turns the grid a quarter turn clockwise. `scratch` holds 81, for the turn to work in. */
export function turnGrid(cells: Uint8Array, scratch: Uint8Array): void {
    scratch.set(cells);
    for (let row = 0; row < 9; row++) {
        for (let column = 0; column < 9; column++) {
            // A clockwise turn brings the left column, read upwards, into the top row
            cells[row * 9 + column] = scratch[(8 - column) * 9 + row];
        }
    }
}
