// ---------------------------------------------------------------------------
// The farmhand
// ---------------------------------------------------------------------------

/** How fast the farmhand walks and strings wire, in grid steps per second. */
export const FARMHAND_SPEED = 11;

/** How long the farmhand can stand still with wire out before it starts to go slack. */
export const SLACK_DELAY_MS = 450;

/** How fast slack runs along a wire from its post, in grid steps per second. */
export const SLACK_SPEED = 9;

// ---------------------------------------------------------------------------
// Dust devils, beetles and sheep
// ---------------------------------------------------------------------------

/** How close to a full-size dust devil's middle, in cells, a wire or the farmhand is caught. */
export const DEVIL_RADIUS = 1.6;

/** How long a dust devil takes to blow itself out. */
export const DEVIL_BLOW_OUT_MS = 1200;

/**
 * How much room a dust devil needs to be full size. Room is its region's
 * cells, as a multiple of the region at which it blows out. With less room,
 * it shrinks.
 */
export const DEVIL_FULL_ROOM = 5;

/** How small a dust devil gets, as a share of its full size, just before it blows out. */
export const DEVIL_MIN_SIZE = 0.55;

/** With less room than this, a dust devil is starving. It is one cut from blowing out. */
export const DEVIL_STARVING_ROOM = 2;

/**
 * A dust devil left in a region no bigger than this share of the meadow
 * blows itself out, and its region is fenced off.
 */
export const STARVE_SHARE = 0.1;

/** How long a new beetle takes to hatch, harmless, before it crawls. */
export const BEETLE_HATCH_MS = 1200;

/** How close a beetle must come to the farmhand, in grid steps, to catch them. */
export const BEETLE_CATCH_DISTANCE = 0.7;

/** How fast a sheep ambles, and how fast it runs from a dust devil, in cells per second. */
export const SHEEP_WALK_SPEED = 1.5;
export const SHEEP_FLEE_SPEED = 5;

/** How close a dust devil comes, in cells, before a sheep runs. */
export const SHEEP_FLEE_DISTANCE = 6;

/** A sheep's half-width, in cells, which keeps it off the fences. */
export const SHEEP_RADIUS = 0.45;

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

/** Lives at the start of a game. */
export const START_LIVES = 3;
/** How long each round's opening moment lasts, before play. */
export const READY_MS = 1800;
/** How long play stops when the farmhand is caught. */
export const SNAPPED_MS = 1600;
/** How long the round-clear tally shows before the next round. */
export const ROUND_CLEAR_MS = 3600;

/**
 * The longest step the game advances by at once. A longer update runs as
 * several steps, so nothing moves through a fence after a slow frame.
 */
export const MAX_STEP_MS = 20;
