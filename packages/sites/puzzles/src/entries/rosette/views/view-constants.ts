import { MARGIN, PAGE_WIDTH } from '../../../shared';

// The colours, text styles and calendar that every puzzle on the site shares
// are in its shared folder. These are Rosette's.

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

/** The space the picture is fitted into, and centred in. */
export const BOARD_X = MARGIN;
export const BOARD_Y = 72;
export const BOARD_WIDTH = PAGE_WIDTH;
export const BOARD_HEIGHT = 560;

/** The line under the picture that counts the swaps. */
export const STATUS_Y = BOARD_Y + BOARD_HEIGHT + 14;

/** The buttons under the picture: undo, and how to play. */
export const BUTTON_Y = STATUS_Y + 18;
export const BUTTON_GAP = 8;
export const BUTTON_WIDTH = (PAGE_WIDTH - BUTTON_GAP) / 2;
export const BUTTON_HEIGHT = 48;

/** The line of help along the bottom. */
export const HINT_Y = BUTTON_Y + BUTTON_HEIGHT + 20;

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

/** The lead between the pieces, as in a leaded window, and its colour once the picture is solved, inside a rim that stays dark. */
export const LEAD_COLOR = 0x2a2a30;
export const SOLVED_LEAD_COLOR = 0xffffff;
/** Half the lead's width between two pieces, and round the picture's rim, in pixels. */
export const LEAD_HALF_WIDTH = 1.25;
export const RIM_WIDTH = 5;
/**
 * How long a swapped piece takes to fly to its new tile, in ms, the longest
 * of any flight, so what follows a swap, such as the locks growing, waits
 * this long for it to land.
 */
export const FLY_MS = 420;
/** How far above the pointer a dragged piece is drawn, in pixels, so a finger doesn't hide it. A dropped piece settles from there. */
export const LIFT_RAISE = 6;
/** How long a locked group takes to lift, shake and settle as a piece joins it, in ms. */
export const SETTLE_MS = 480;
/** When the sun starts to come up behind a mended window, in ms after the celebration's ripple reaches the frame. */
export const SUN_FROM_MS = 800;
/** The outline of a piece picked up, and of the tile it would swap with. */
export const PICKED_COLOR = 0xffffff;
export const TARGET_COLOR = 0xffffff;
