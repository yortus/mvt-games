import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are Sudoku's.

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels, every puzzle's: tall, to suit a phone held upright. The way in is laid out on it. */
export { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../shared';

// ---------------------------------------------------------------------------
// The puzzle's screen
// ---------------------------------------------------------------------------

/** A cell's size, and where the grid's top left corner is, in pixels. The grid fills the page between the margins. */
export const CELL_SIZE = PAGE_WIDTH / 9;
export const GRID_SIZE = PAGE_WIDTH;
export const GRID_X = MARGIN;
export const GRID_Y = 82;

/** The bar along the top, with the way back and the puzzle's date and level. */
export const BACK_WIDTH = 128;
export const BAR_BUTTON_HEIGHT = 44;
export const BAR_Y = 18;

/** The keypad under the grid, a key for each digit. */
export const KEYPAD_Y = GRID_Y + GRID_SIZE + 14;
export const KEY_GAP = 4;
export const KEY_WIDTH = (GRID_SIZE - KEY_GAP * 8) / 9;
export const KEY_HEIGHT = 52;
/** How long a key must be held to fill a cell, and how long before its ring starts to show, in ms. */
export const KEY_HOLD_MS = 450;
export const KEY_HOLD_QUIET_MS = 100;

/** The buttons under the keypad: undo, and the tutorial. */
export const TOOL_Y = KEYPAD_Y + KEY_HEIGHT + 12;
export const TOOL_GAP = 8;
export const TOOL_WIDTH = (GRID_SIZE - TOOL_GAP) / 2;
export const TOOL_HEIGHT = 48;

/** The line of help along the bottom. */
export const HINT_Y = TOOL_Y + TOOL_HEIGHT + 26;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** A given cell, a shade darker than the cells to fill in. */
export const GIVEN_CELL_COLOR = 0xeae3d4;
export const BOX_LINE_COLOR = 0x3b3832;
/** The cells selected, as if run over with a highlighter. */
export const SELECTED_CELL_COLOR = 0xfbeaa5;
/**
 * The group notes' colours, taken in turn, so notes side by side are told
 * apart: violet, teal, olive, slate and petrol. Each is dark enough for its
 * digits. None is warm, as reds and oranges read as errors and warnings,
 * and none is the answers' blue or the highlighter's yellow.
 */
export const GROUP_COLORS: readonly number[] = [0x6b47c2, 0x177a68, 0x52701c, 0x4b6478, 0x1d6a8f];
