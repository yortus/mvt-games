import { MOST_CELL_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a grid goes, in pixels, from the top left corner of the space it is fitted into. */
export interface BoardLayout {
    readonly cellSize: number;
    /** The grid's top left corner. */
    readonly gridX: number;
    readonly gridY: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardLayoutOptions {
    /** How many cells along each side of the grid. */
    readonly size: number;
    /** The space to fit into. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Fits a grid into a space, as large as it will go, up to `MOST_CELL_SIZE` a cell, and centres it. */
export function layOutBoard(options: BoardLayoutOptions): BoardLayout {
    const { size, width, height } = options;
    const cellSize = Math.min(MOST_CELL_SIZE, width / size, height / size);
    return { cellSize, gridX: (width - size * cellSize) / 2, gridY: (height - size * cellSize) / 2 };
}
