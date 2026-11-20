// What is known of a cell, or of an edge between two cells, as the solver and
// the puzzle maker keep it. Each is not yet known, river, or dry. A river cell
// has the river running through it, and a river edge has the river crossing
// it, from one cell to the next. The river keeps away from a dry cell or edge.
// The states are small numbers, not strings, so that a whole valley of them
// fits in a `Uint8Array`. The solver copies and scans these arrays many times
// for each puzzle it makes.

/** A cell or edge not yet known to be river or dry. */
export const UNKNOWN = 0;

/** A cell the river runs through, or an edge it crosses. */
export const RIVER = 1;

/** A cell or edge the river keeps away from. */
export const DRY = 2;
