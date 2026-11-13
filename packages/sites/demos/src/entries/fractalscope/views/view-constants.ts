// ---------------------------------------------------------------------------
// The image
// ---------------------------------------------------------------------------

/**
 * The most samples the image is computed on. A phone's screen asks for three
 * or four pixels per point of CSS, which would be millions of samples for a
 * picture no sharper than the screen can show.
 */
export const MAX_SAMPLES = 1400000;

/** The most samples the image gets for each point of CSS, along either side. */
export const MAX_SAMPLE_DENSITY = 2;

/** What shows where nothing is known yet, such as the edge a drag uncovers. */
export const BACKDROP_COLOR = 0x05060a;

// ---------------------------------------------------------------------------
// The gestures
// ---------------------------------------------------------------------------

/** How much one notch of the mouse wheel magnifies the view. */
export const ZOOM_PER_WHEEL_NOTCH = 1.25;

/** How much a double click or a double tap magnifies the view. */
export const ZOOM_PER_DOUBLE_TAP = 2.5;

// ---------------------------------------------------------------------------
// The minimap
// ---------------------------------------------------------------------------

/** The minimap's own pixels. It covers a fractal's rest setting, four wide for every three tall. */
export const MINIMAP_WIDTH = 240;
export const MINIMAP_HEIGHT = 180;

/**
 * The smallest the mark of what the scope takes in may be drawn on the
 * minimap, in its pixels. Magnified, the scope takes in far less than one
 * pixel of the map, and the mark becomes a pin on the spot.
 */
export const MIN_SCOPE_MARK = 7;
