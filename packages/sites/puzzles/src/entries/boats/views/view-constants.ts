import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are Boats'.

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels, the same for every puzzle. It's tall, to suit a phone held upright. The way in is laid out on it. */
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

/** The left of the space that the harbour, its numbers and its fleet are centred in. */
export const BOARD_X = MARGIN;

/** The top of the space the harbour is fitted into. */
export const BOARD_Y = 76;

/** The width of the space the harbour is fitted into. */
export const BOARD_WIDTH = PAGE_WIDTH;

/** The height of the space the harbour is fitted into. */
export const BOARD_HEIGHT = 590;

/** The top of the two buttons under the harbour, Undo and How to play. */
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
// The harbour
// ---------------------------------------------------------------------------

/** The largest a cell is drawn, in pixels, however few cells there are. */
export const MOST_CELL_SIZE = 64;

/** The pale aqua of shallow water not yet known. */
export const SHALLOWS_COLOR = 0xc4ecf7;

/** The clear blue of a cell the player has marked as water. */
export const WATER_COLOR = 0x5cbde6;

/** The faint lines between the cells, lighter than the water, like the edges of ripples. */
export const RIPPLE_LINE_COLOR = 0x9fdcf1;

/** The white of the waves the player marks water with, and of the glints that twinkle on the water. */
export const WAVE_COLOR = 0xffffff;

/** The deep navy of the givens. Given waves and the hulls of given boats are drawn in it. */
export const NAVY_COLOR = 0x203a5c;

/** The shadow a boat casts on the water. */
export const SHADOW_COLOR = 0x174a73;

/**
 * Each boat's hull colour, by its length, from one cell to four. There's a
 * coral dinghy, a sunflower skiff, a mint yacht and a lilac ferry. Every
 * fleet's longest boat is four cells, and a longer run of boat cells shows
 * in red. A boat's length shows in its size too, so the colour is never the
 * only way to tell boats apart.
 */
export const HULL_COLORS: readonly number[] = [0xff7a6b, 0xffc53d, 0x34c49c, 0xa27ce6];

/** The white of the cabins on the hulls. */
export const CABIN_COLOR = 0xffffff;

/** The blue of the cabins' little windows. */
export const WINDOW_COLOR = 0x5cbde6;

/** The pale hull of a boat in the fleet list not yet found. */
export const UNFOUND_HULL_COLOR = 0xddd5c4;
