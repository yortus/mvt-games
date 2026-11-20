import { MOST_CELL_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a valley, its numbers and its ends go, in pixels, from the top left corner of the space they are fitted into. */
export interface BoardLayout {
    /** The size of each cell. */
    readonly cellSize: number;
    /** The left of the valley. */
    readonly gridX: number;
    /** The top of the valley. */
    readonly gridY: number;
    /** The size of the numbers, along the top and down the right. */
    readonly clueSize: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a board is laid out from. */
export interface BoardLayoutOptions {
    /** How many cells along each side of the valley. */
    readonly size: number;
    /** The width of the space to fit into. */
    readonly width: number;
    /** The height of the space to fit into. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Fits a valley into a space, as large as it will go, up to
 * `MOST_CELL_SIZE` a cell, and centres it. It leaves a strip on each side:
 * for the numbers above it and to its right, for the spring to its left,
 * and for the sea below it.
 */
export function layOutBoard(options: BoardLayoutOptions): BoardLayout {
    const { size, width, height } = options;
    const cellSize = Math.min(MOST_CELL_SIZE, width / (size + STRIP_SHARE * 2), height / (size + STRIP_SHARE * 2));
    // The strips are as deep on every side, so the valley sits in the middle
    return {
        cellSize,
        gridX: (width - size * cellSize) / 2,
        gridY: (height - size * cellSize) / 2,
        clueSize: Math.min(MOST_CLUE_SIZE, cellSize * CLUE_TEXT_SHARE),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How deep each strip round the valley is, and how large the numbers are, as shares of a cell, and the largest the numbers are drawn. */
const STRIP_SHARE = 0.75;
const CLUE_TEXT_SHARE = 0.5;
const MOST_CLUE_SIZE = 26;
