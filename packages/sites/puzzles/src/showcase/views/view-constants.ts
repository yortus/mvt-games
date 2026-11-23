import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The play area, in pixels. */
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 600;

/** The dark of the desk's edges, round the play area. */
export const DESK_SHADOW = 0x1c140e;

/** The camera's field of view, top to bottom, in degrees. */
export const FIELD_OF_VIEW = 40;

/** How high the open pages lie above the desk, in metres, on the leaves under them. */
export const LEAF_Y = 0.006;
/** How much higher a turning page starts, so it lies over the pages it turns from and to. */
export const TURNING_LIFT = 0.0008;
/** How thick each leaf of the paper is, for the edges of the piles under the open pages. */
export const LEAF_THICKNESS = 0.0007;

/** Each page's picture, in pixels. It's the page's shape. */
export const PAGE_TEXTURE_WIDTH = 1024;
export const PAGE_TEXTURE_HEIGHT = Math.round((PAGE_TEXTURE_WIDTH * PAGE_HEIGHT) / PAGE_WIDTH);

/** Newsprint, a warm off-white close to the puzzles' own paper, so a puzzle's box sits on the page without a seam. */
export const NEWSPRINT_COLOR = '#f1ebdf';
/** The paper's ink, and the grey of text too small to read. */
export const INK_COLOR = '#1d1b18';
export const GREY_TEXT_COLOR = '#9b958a';
/** The paper's type. */
export const SERIF_FONT = 'Georgia, "Times New Roman", Times, serif';
