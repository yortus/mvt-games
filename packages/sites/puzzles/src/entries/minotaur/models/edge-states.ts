// What is known of an edge, as a solver or a player has it, kept as a small
// number in a typed array: not yet known, a passage the path crosses, or a
// wall. The outer border is always wall.

export const UNKNOWN = 0;
export const PASSAGE = 1;
export const WALL = 2;
