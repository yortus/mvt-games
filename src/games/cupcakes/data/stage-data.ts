// ---------------------------------------------------------------------------
// Grid Constants (world-units / domain-level)
// ---------------------------------------------------------------------------

/** Number of rows in the cupcake grid. */
export const GRID_ROWS = 8;

/** Number of columns in the cupcake grid. */
export const GRID_COLS = 8;

/** Size of one cell in world-units. */
export const CELL_SIZE = 40;

/** Number of distinct cupcake flavours. */
export const CUPCAKE_KIND_COUNT = 6;

// ---------------------------------------------------------------------------
// Timing Constants
// ---------------------------------------------------------------------------

/** Duration of a swap animation in milliseconds. */
export const SWAP_DURATION_MS = 200;

/** Duration of the match fade-out in milliseconds. */
export const MATCH_FADE_MS = 250;

/** Speed at which cupcakes fall in rows per second. */
export const FALL_SPEED = 12;

// ---------------------------------------------------------------------------
// Screen Constants (view-layer only)
// ---------------------------------------------------------------------------

/** Height of the HUD bar below the board in pixels. */
export const HUD_HEIGHT = 36;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points per cupcake matched in a group. */
export const POINTS_PER_CUPCAKE = 10;

/** Bonus multiplier for each cascade step beyond the first. */
export const CASCADE_MULTIPLIER = 1.5;
