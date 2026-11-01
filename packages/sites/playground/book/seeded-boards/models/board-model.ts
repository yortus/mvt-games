import type { Random } from './seeded-random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The colour of a cactus. */
export type CactusKind = 'green' | 'pink' | 'blue' | 'gold';

/** A board of cactii, dealt at random as it's made. */
export interface BoardModel {
    readonly rows: number;
    readonly cols: number;
    readonly kindAt: (row: number, col: number) => CactusKind;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardModelOptions {
    readonly rows: number;
    readonly cols: number;
    /** Where the deal's random numbers come from. The same numbers deal the same board. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a board, and deals a cactus into every cell. */
export function createBoardModel({ rows, cols, random }: BoardModelOptions): BoardModel {
    const kinds: CactusKind[] = [];
    for (let i = 0; i < rows * cols; i++) kinds.push(KINDS[Math.floor(random() * KINDS.length)]);

    return {
        rows,
        cols,
        kindAt: (row, col) => kinds[row * cols + col],
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KINDS: readonly CactusKind[] = ['green', 'pink', 'blue', 'gold'];
