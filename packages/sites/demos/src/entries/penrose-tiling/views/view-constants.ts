// ---------------------------------------------------------------------------
// The look
// ---------------------------------------------------------------------------

/**
 * Where the one control for tiles and grids starts, from 0 to 1. Below it,
 * the gaps between the tiles narrow to nothing. Above it, the tiles draw back
 * to their crossings.
 */
export const DEFAULT_GRID_REVEAL = 0.1;

/** The gap between tiles at `DEFAULT_GRID_REVEAL`, its widest, in tile edges. */
export const DEFAULT_GAP = 0.06;

/** How fast the colours can flow while the tiling drifts, in whole palettes per second. */
export const MAX_FLOW_SPEED = 0.25;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** How many colours each palette is blended into, from one end to the other: enough that a colour flowing never shows a step. */
export const RAMP_SIZE = 256;

/** How many tones of each colour there are: darker, as it is, and lighter. */
export const TONES = 3;

/** How far the darker tone is mixed toward black, and the lighter toward white, from 0 to 1. */
export const DARKER_MIX = 0.22;
export const LIGHTER_MIX = 0.18;

/** How far apart the rings of colour are, in tile edges, in the `rings` colour mode. */
export const RING_WIDTH = 10;

/** How far apart the turns of the spiral are, in tile edges, in the `spiral` colour mode. */
export const SPIRAL_WIDTH = 14;

/** The most device pixels the canvas draws for each CSS pixel. A phone's screen asks for three, which costs more than it shows. */
export const MAX_PIXEL_DENSITY = 2;

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------

/** How much one notch of the mouse wheel zooms in. */
export const ZOOM_PER_WHEEL_NOTCH = 1.2;

/** How much a double click or a double tap zooms in. */
export const ZOOM_PER_DOUBLE_TAP = 1.8;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** How far one press of a shift key shifts the grids, as a share of a whole shift. Holding it repeats. */
export const SHIFT_PER_KEY = 0.004;
