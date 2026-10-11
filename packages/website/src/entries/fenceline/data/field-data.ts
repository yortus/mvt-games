// ---------------------------------------------------------------------------
// The meadow
// ---------------------------------------------------------------------------

// The meadow is a grid of cells. Fences run along the lines between cells,
// from one grid point to the next, so a fence has no width. A grid point is
// named by its row and column too: point (r, c) is the top left corner of
// cell (r, c), and the meadow's points run from (0, 0) to
// (FIELD_ROWS, FIELD_COLS).

/** Columns of cells across the meadow. */
export const FIELD_COLS = 60;

/** Rows of cells down the meadow. */
export const FIELD_ROWS = 42;

/**
 * What a cell is. Meadow is wild grass, still open. Pasture has been fenced
 * off. A pond or a rock was there from the start: no one can cross it, and it
 * counts towards neither.
 */
export type CellKind = 'meadow' | 'pasture' | 'pond' | 'rock';
