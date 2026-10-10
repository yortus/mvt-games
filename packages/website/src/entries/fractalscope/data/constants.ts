// ---------------------------------------------------------------------------
// How far the view may travel
// ---------------------------------------------------------------------------

/** How far the view may zoom out past a fractal's home view, as how many times wider. */
export const MAX_ZOOM_OUT = 2;

/**
 * The narrowest view. A double carries about 16 significant digits, and
 * below this width neighbouring samples hold the same number, so the image
 * breaks into flat blocks.
 */
export const MIN_SPAN = 1e-13;

/**
 * How far the centre of the view may travel from the centre of a fractal's
 * home view, along either axis. It keeps the visitor from panning into
 * empty plane and losing the fractal.
 */
export const MAX_CENTER_DRIFT = 2.5;
