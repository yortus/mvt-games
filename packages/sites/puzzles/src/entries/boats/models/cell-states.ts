// What a cell holds, as the solver and the puzzle maker keep it: not yet
// known, part of a boat, or open water. A solution has only boats and water.
// The states are small numbers, not strings, so that a whole harbour of them
// fits in a `Uint8Array`, which the solver copies and scans many times for
// each puzzle it makes.

/** A cell not yet known to hold a boat or water. */
export const UNKNOWN = 0;

/** A cell with part of a boat in it. */
export const BOAT = 1;

/** A cell of open water. */
export const WATER = 2;
