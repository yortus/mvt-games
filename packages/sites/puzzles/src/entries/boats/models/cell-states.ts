// What a cell holds, as the solver and the puzzle maker keep it. A cell is
// part of a boat, open water, or not yet known. A solution has only boats and
// water. These are small numbers, not strings, so that a whole harbour of
// them fits in a `Uint8Array`. The solver copies and scans that array many
// times while each puzzle is made.

/** A cell not yet known to hold a boat or water. */
export const UNKNOWN = 0;

/** A cell with part of a boat in it. */
export const BOAT = 1;

/** A cell of open water. */
export const WATER = 2;
