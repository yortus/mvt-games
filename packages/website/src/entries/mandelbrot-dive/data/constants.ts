// ---------------------------------------------------------------------------
// The home view
// ---------------------------------------------------------------------------

/**
 * Where the explorer starts, in the complex plane. The Mandelbrot set lies
 * between -2 and 0.5 along the real axis, so the home view is centred a
 * little left of the origin, with a margin around the set.
 */
export const HOME_CENTER_RE = -0.6;
export const HOME_CENTER_IM = 0;

/** How wide the home view is, in units of the complex plane. */
export const HOME_SPAN = 3.2;

// ---------------------------------------------------------------------------
// How far the view may travel
// ---------------------------------------------------------------------------

/** The widest view, so that zooming out stops a little beyond home. */
export const MAX_SPAN = HOME_SPAN * 2;

/**
 * The narrowest view. A double carries about 16 significant digits, and
 * below this width neighbouring samples hold the same number, so the image
 * breaks into flat blocks.
 */
export const MIN_SPAN = 1e-13;

/**
 * How far the centre of the view may travel from the home centre, along
 * either axis. It keeps the visitor from panning into empty plane and
 * losing the set.
 */
export const MAX_CENTER_DRIFT = 2.5;
