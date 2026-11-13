// What a cell holds, as the solver and the puzzle maker keep it: not yet
// known, a star, or empty. A solution has only stars and empty cells.

export const UNKNOWN = 0;
export const STAR = 1;
export const EMPTY = 2;

/** How many stars every row, column and region holds. */
export const STARS_PER_LINE = 2;
