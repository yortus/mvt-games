// ---------------------------------------------------------------------------
// Arena (world-units)
// ---------------------------------------------------------------------------

// The arena is a portrait screen, as on a 1990s vertical shooter cabinet.
// Positions are in world-units, x to the right and y down the screen, so the
// ship flies toward smaller y. Angles are in radians in the models (degrees in
// the data tables), measured from +x toward +y: 90 degrees is straight down.

/** Width of the play area in world-units. */
export const ARENA_WIDTH = 240;

/** Height of the play area in world-units. */
export const ARENA_HEIGHT = 320;

/** How many times the stage is played, each loop harder, before the game is won. */
export const LOOP_COUNT = 2;
