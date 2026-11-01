import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are Minotaur's.

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels, every puzzle's: tall, to suit a phone held upright. The way in is laid out on it. */
export { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../shared';

// ---------------------------------------------------------------------------
// The puzzle's screen
// ---------------------------------------------------------------------------

/** The bar along the top, with the way back and the puzzle's date and level. */
export const BACK_WIDTH = 128;
export const BAR_BUTTON_HEIGHT = 44;
export const BAR_Y = 18;

/** The space the maze and its clues are fitted into, and centred in. */
export const BOARD_X = MARGIN;
export const BOARD_Y = 76;
export const BOARD_WIDTH = PAGE_WIDTH;
export const BOARD_HEIGHT = 590;

/** The buttons under the maze: undo, and how to play. */
export const BUTTON_Y = BOARD_Y + BOARD_HEIGHT + 12;
export const BUTTON_GAP = 8;
export const BUTTON_WIDTH = (PAGE_WIDTH - BUTTON_GAP) / 2;
export const BUTTON_HEIGHT = 48;

/** The line of help along the bottom. */
export const HINT_Y = BUTTON_Y + BUTTON_HEIGHT + 22;

// ---------------------------------------------------------------------------
// The maze
// ---------------------------------------------------------------------------

/** The largest a cell is drawn, in pixels, however few cells there are. */
export const MOST_CELL_SIZE = 76;

/** The size of the clues' numbers, as a share of a cell, and the least and most, in pixels. */
export const CLUE_SHARE = 0.46;
export const LEAST_CLUE_SIZE = 13;
export const MOST_CLUE_SIZE = 22;
