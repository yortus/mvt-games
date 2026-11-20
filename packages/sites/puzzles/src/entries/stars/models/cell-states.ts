// What a cell holds, as the solver and the puzzle maker keep it: not yet
// known, a star, or empty. A solution has only stars and empty cells. The
// states are small numbers, not strings, so that a whole grid of them fits
// in a `Uint8Array`, which the solver copies and scans many times for each
// puzzle it makes.

/** A cell not yet known to be a star or empty. */
export const UNKNOWN = 0;

/** A cell with a star. */
export const STAR = 1;

/** A cell that doesn't hold a star. */
export const EMPTY = 2;
