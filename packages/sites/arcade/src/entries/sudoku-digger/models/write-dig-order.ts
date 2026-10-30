import type { Random } from './random';
import { CELL_COUNT } from './sudoku-rules';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The order the cells are visited in for digging:
 *
 * - **random**: every cell, shuffled.
 * - **every-other**: along the snake, every other cell, then the cells it
 *   skipped.
 * - **snake**: along each row, left to right, then right to left on the
 *   next row, and so on, down the grid.
 * - **reading**: along each row, left to right, from the top row down.
 */
export type DigOrderKind = 'random' | 'every-other' | 'snake' | 'reading';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Writes the cells, in the order of `kind`, into `order`, which holds 81. */
export function writeDigOrder(order: Uint8Array, kind: DigOrderKind, random: Random): void {
    switch (kind) {
        case 'reading':
            for (let i = 0; i < CELL_COUNT; i++) order[i] = i;
            break;
        case 'snake':
            for (let i = 0; i < CELL_COUNT; i++) order[i] = toSnakeCell(i);
            break;
        case 'every-other': {
            let next = 0;
            for (let i = 0; i < CELL_COUNT; i += 2) order[next++] = toSnakeCell(i);
            for (let i = 1; i < CELL_COUNT; i += 2) order[next++] = toSnakeCell(i);
            break;
        }
        case 'random':
            // A Fisher-Yates shuffle
            for (let i = 0; i < CELL_COUNT; i++) order[i] = i;
            for (let i = CELL_COUNT - 1; i > 0; i--) {
                const j = Math.floor(random.next() * (i + 1));
                const swap = order[i];
                order[i] = order[j];
                order[j] = swap;
            }
            break;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The cell at place `i` along the snake. */
function toSnakeCell(i: number): number {
    const row = Math.floor(i / 9);
    const along = i % 9;
    return row * 9 + (row % 2 === 0 ? along : 8 - along);
}
