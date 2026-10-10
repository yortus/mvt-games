// ---------------------------------------------------------------------------
// The passes
// ---------------------------------------------------------------------------

/**
 * How wide the blocks of the first pass are, in samples. Each pass halves
 * them, so the first pass covers the whole image in one frame and the ones
 * after it sharpen what is already there.
 */
export const COARSEST_BLOCK = 16;

// ---------------------------------------------------------------------------
// The work of one frame
// ---------------------------------------------------------------------------

/**
 * How many iterations one frame of a screen running at its ease buys. It is
 * about six milliseconds of work on a laptop of 2020, which leaves the rest
 * of the frame to the page.
 */
export const ITERATIONS_PER_FRAME = 1500000;

/** The step the budget is sized for: one frame of a 60Hz screen. */
export const TARGET_STEP_MS = 16.7;

/**
 * The least of the budget a long step keeps. A step longer than the target
 * buys proportionally less work, so that a machine that cannot keep up asks
 * for less rather than more. Without it, a slow frame would buy a longer
 * one, and the next longer still.
 */
export const MIN_BUDGET_SHARE = 0.25;

// ---------------------------------------------------------------------------
// How much detail a sample gets
// ---------------------------------------------------------------------------

/** How many iterations a sample gets in the home view. */
export const BASE_ITERATIONS = 180;

/** How many more it gets for each halving of the view's width. */
export const ITERATIONS_PER_HALVING = 26;

/** The most a sample ever gets, however deep the view goes. */
export const MAX_ITERATIONS = 4000;

// ---------------------------------------------------------------------------
// The gesture
// ---------------------------------------------------------------------------

/**
 * How long the view waits, after the last pan or zoom, before the image is
 * computed again. It gathers a run of mouse-wheel notches into one.
 */
export const SETTLE_MS = 120;

// ---------------------------------------------------------------------------
// The overview
// ---------------------------------------------------------------------------

/** The sample grid of the overview, the whole set at a glance. */
export const OVERVIEW_COLS = 160;
export const OVERVIEW_ROWS = 120;

/** How many iterations the overview's samples get. It only has to show the set's shape. */
export const OVERVIEW_ITERATIONS = 140;
