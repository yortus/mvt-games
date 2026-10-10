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

/** How much a trackpad pinch magnifies the view for each point it is spread. */
export const ZOOM_PER_PINCH_POINT = 0.01;

/** The most one wheel event may magnify or shrink the view, however big its delta. */
export const MAX_WHEEL_ZOOM = 4;

/** How much a double click or a double tap magnifies the view. */
export const ZOOM_PER_DOUBLE_TAP = 2.5;

/** The furthest a finger may travel, in CSS pixels, and still count as a tap. */
export const TAP_SLOP = 10;

/** The longest a finger may stay down, in milliseconds, and still count as a tap. */
export const TAP_MAX_MS = 300;

/** The longest gap between two taps of a double tap, in milliseconds, from the first's lift to the second's. */
export const DOUBLE_TAP_GAP_MS = 350;

/** How far apart the two taps of a double tap may land, in CSS pixels. */
export const DOUBLE_TAP_SLOP = 30;

// ---------------------------------------------------------------------------
// The minimap
// ---------------------------------------------------------------------------

/** The minimap's own pixels. It covers the home view, so its shape is the home view's. */
export const MINIMAP_WIDTH = 240;
export const MINIMAP_HEIGHT = 180;

/**
 * The smallest the mark of the current view may be drawn on the minimap, in
 * its pixels. Zoomed in, the view is far smaller than one pixel of the map,
 * and the mark becomes a pin on the spot.
 */
export const MIN_VIEW_MARK = 7;
