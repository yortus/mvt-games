import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are Stars'.

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

/** The left of the space the grid is fitted into, and centred in. */
export const BOARD_X = MARGIN;

/** The top of the space the grid is fitted into. */
export const BOARD_Y = 76;

/** The width of the space the grid is fitted into. */
export const BOARD_WIDTH = PAGE_WIDTH;

/** The height of the space the grid is fitted into. */
export const BOARD_HEIGHT = 590;

/** The top of the two buttons under the grid, Undo and How to play. */
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
// The grid
// ---------------------------------------------------------------------------

/** The largest a cell is drawn, in pixels, however few cells there are. */
export const MOST_CELL_SIZE = 64;

/**
 * The soft tints the regions are washed with, so each stands out from the
 * regions beside it. No two regions that share a side get the same tint.
 */
export const REGION_TINTS: readonly number[] = [0xfbe4d2, 0xdcebd8, 0xdbe6f4, 0xf1dfee, 0xf6efc9, 0xd7eeea, 0xeee0d3];

/** The violet the groups the player rings are drawn in, apart from the stars' gold and the regions' ink. */
export const GROUP_COLOR = 0x7b4fc9;

/** The gold of the player's stars. */
export const STAR_COLOR = 0xf0b429;

/** The darker gold of the edge round the player's stars, which keeps them clear on the pale yellow tint. */
export const STAR_EDGE_COLOR = 0xa8740c;

/** The faint blue of the player's crosses, the notes that a cell has no star. */
export const CROSS_COLOR = 0x7f9fd8;
