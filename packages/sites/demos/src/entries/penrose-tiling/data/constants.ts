// ---------------------------------------------------------------------------
// Symmetry
// ---------------------------------------------------------------------------

/**
 * The symmetries a tiling can have, in order. Each is the number of ways a
 * tile can point. 5 is the Penrose tiling. 3 and 4 tile the plane in a
 * pattern that repeats, cubes and squares. The rest never repeat, just as
 * the Penrose tiling doesn't.
 */
export const SYMMETRIES: readonly number[] = [3, 4, 5, 7, 8, 9, 11, 12, 13];

/** The symmetry a tiling starts with: the Penrose tiling's. */
export const DEFAULT_SYMMETRY = 5;

// ---------------------------------------------------------------------------
// The window onto the tiling
// ---------------------------------------------------------------------------

/**
 * How far the window reaches, from its centre to its furthest corner, in
 * tile edges. The smallest is the closest in.
 */
export const MIN_RADIUS = 3;
export const MAX_RADIUS = 36;
export const DEFAULT_RADIUS = 12;

/** How long the window takes to ease back to where it started, in milliseconds. */
export const RESET_MS = 700;

// ---------------------------------------------------------------------------
// The tiling's drift
// ---------------------------------------------------------------------------

/**
 * How far apart the shifts are that tiles are laid at, as a share of a whole
 * shift. Between two of them, the picture dissolves from one to the next.
 */
export const SHIFT_STEP = 1 / 128;
/** How fast the grids can shift while the tiling drifts, in whole shifts per second. */
export const MAX_MORPH_SPEED = 0.05;
