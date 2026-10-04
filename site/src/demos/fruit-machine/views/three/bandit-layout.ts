import { SYMBOL_COLORS, SYMBOL_TONES } from '../art';

// ---------------------------------------------------------------------------
// Layout, in world units (about a foot each), the cabinet's front facing +z
// ---------------------------------------------------------------------------

/**
 * A drum's radius. Three symbols must fill the window's height, so with 28
 * symbols round a drum it has to be big: like the real thing, the cabinet is
 * deep to fit them.
 */
export const DRUM_RADIUS = 2.4;
/** A drum's width: about one symbol's arc, so the pictures keep their shape. */
export const DRUM_WIDTH = 0.56;
export const DRUM_GAP = 0.08;
export const DRUM_COUNT = 5;
/** The drums' shared axis: its height, and how far forward of the cabinet's centre. */
export const DRUM_AXIS_Y = 3.1;
export const DRUM_AXIS_Z = 0.35;

/** The x of a drum's centre. */
export function drumX(reel: number): number {
    return (reel - (DRUM_COUNT - 1) / 2) * (DRUM_WIDTH + DRUM_GAP);
}

export const BODY_WIDTH = 5;
export const BODY_BOTTOM = 0.5;
export const BODY_TOP = 5.7;
/** The front face of the cabinet, round the window. */
export const FRONT_Z = 2.95;
export const BACK_Z = -2.8;
export const PANEL_THICKNESS = 0.2;

export const WINDOW_WIDTH = DRUM_COUNT * DRUM_WIDTH + (DRUM_COUNT - 1) * DRUM_GAP + 0.24;
export const WINDOW_HEIGHT = 1.6;

/**
 * The lever's pivot, out from the cabinet's right side on a bracket, and well
 * forward, where the player's hand would be: far enough out to stay in sight
 * as the cabinet sways.
 */
export const LEVER_X = BODY_WIDTH / 2 + 0.75;
export const LEVER_Y = 3.1;
export const LEVER_Z = 2.1;
/** How far the bracket reaches from the cabinet's side to the pivot. */
export const LEVER_BRACKET = 0.75;
export const LEVER_LENGTH = 2.6;

/**
 * How far, in CSS pixels, a press may move and still be a tap. Further, and
 * it turns the cabinet instead; the page gives the pointer picker the same
 * figure, so the lever isn't pulled at the end of a drag.
 */
export const DRAG_THRESHOLD_PX = 6;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

// Named by role, so a recolour is one edit here. A warm scheme from the
// fruit: lemon yellow paint, watermelon pink bands and top box, an orange
// lamp and a red lever knob, with polished chrome trim and a near-black base.
// The lettering is the one cool note, the pale blue of a blueberry's shine,
// light enough to read on the black panels. All but the chrome, base and knob
// come from the symbols' own palette, so the cabinet and the fruit match.

export const BODY_PAINT = SYMBOL_COLORS.pic5;
export const ACCENT_PAINT = SYMBOL_COLORS.pic1;
export const CHROME = '#e4e7eb';
export const BASE = '#231a1b';
export const LEVER_BALL = '#d8283a';
export const LAMP = SYMBOL_COLORS.pic4;
export const DISPLAY_FACE = '#1c1412';
/** Pale blue, a cool note against the warm body, light enough to read on black. */
export const DISPLAY_TEXT = SYMBOL_TONES.pic6.highlight;
