import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are River's.

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels, every puzzle's: tall, to suit a phone held upright. The way in is laid out on it. */
export { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../shared';

// ---------------------------------------------------------------------------
// The puzzle's screen
// ---------------------------------------------------------------------------

/** The width of the button back to the calendar, in the bar along the top. */
export const BACK_WIDTH = 128;

/** The height of the button back to the calendar. */
export const BAR_BUTTON_HEIGHT = 44;

/** The top of the bar along the top, which holds the way back and the puzzle's date and level. */
export const BAR_Y = 18;

/** The left of the space the valley, its numbers and its ends are fitted into, and centred in. */
export const BOARD_X = MARGIN;

/** The top of the space the valley is fitted into. */
export const BOARD_Y = 76;

/** The width of the space the valley is fitted into. */
export const BOARD_WIDTH = PAGE_WIDTH;

/** The height of the space the valley is fitted into. */
export const BOARD_HEIGHT = 590;

/** The top of the two buttons under the valley, Undo and How to play. */
export const BUTTON_Y = BOARD_Y + BOARD_HEIGHT + 12;

/** The space between the two buttons. */
export const BUTTON_GAP = 8;

/** The width of each of the two buttons, which share the page's width. */
export const BUTTON_WIDTH = (PAGE_WIDTH - BUTTON_GAP) / 2;

/** The height of each of the two buttons. */
export const BUTTON_HEIGHT = 48;

/** The left of the Undo button. The walkthrough's arrow points at it too. */
export const UNDO_X = MARGIN;

/** The left of the How to play button, to the right of Undo. */
export const HOW_TO_PLAY_X = UNDO_X + BUTTON_WIDTH + BUTTON_GAP;

/** The line of help along the bottom. */
export const HINT_Y = BUTTON_Y + BUTTON_HEIGHT + 22;

// ---------------------------------------------------------------------------
// The valley
// ---------------------------------------------------------------------------

/** The largest a cell is drawn, in pixels, however few cells there are. */
export const MOST_CELL_SIZE = 64;

/** The two greens of the meadow's cells, side by side like a chequered field, and the faint lines between them. */
export const MEADOW_COLOR = 0xa6dc82;
export const MEADOW_SHADE_COLOR = 0x9cd577;
export const FIELD_LINE_COLOR = 0xbde6a3;

/** The blades of grass scattered over the meadow. */
export const GRASS_COLOR = 0x7fbf5c;

/** The river: its sandy banks, its water, and the light on the water. */
export const BANK_COLOR = 0xeedc9a;
export const RIVER_COLOR = 0x4aaee6;
export const RIVER_LIGHT_COLOR = 0xbfeafc;

/** The white of the glints that twinkle on the water. */
export const GLINT_COLOR = 0xffffff;

/** The flower the player plants on a cell the river keeps away from: white petals round a golden middle. */
export const PETAL_COLOR = 0xffffff;
export const PETAL_EDGE_COLOR = 0xd6d2c4;
export const FLOWER_MIDDLE_COLOR = 0xffc93c;

/** The bush printed on a given dry cell, in a deep green. */
export const BUSH_COLOR = 0x3f8f45;
