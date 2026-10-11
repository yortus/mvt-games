// ---------------------------------------------------------------------------
// The scope's limits
// ---------------------------------------------------------------------------

/**
 * The least magnification, against a fractal's rest setting. At 0.5 the
 * scope takes in twice as wide a patch as at rest.
 */
export const MIN_MAGNIFICATION = 0.5;

/**
 * The narrowest patch the scope may take in, in units of the complex plane.
 * A double carries about 16 significant digits, and below this width
 * neighbouring points hold the same number.
 */
export const MIN_WIDTH = 1e-13;

/**
 * How far the scope's centre may move from the centre of a fractal's rest
 * setting, along either axis. It keeps the visitor from moving off into
 * empty plane and losing the fractal.
 */
export const MAX_CENTRE_DRIFT = 2.5;
