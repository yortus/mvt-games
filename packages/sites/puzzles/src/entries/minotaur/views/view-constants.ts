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

// ---------------------------------------------------------------------------
// The maze's colours, taken from the earth colours of Minoan frescoes
// ---------------------------------------------------------------------------

/** The sandstone floor. */
export const FLOOR_COLOR = 0xf3e4c3;
/** The faint lines in the dust where walls might be. */
export const DUST_LINE_COLOR = 0xc0a675;
/** A wall's terracotta, and the darker clay of its edge. */
export const WALL_COLOR = 0xb4532a;
export const WALL_EDGE_COLOR = 0x6f2d14;
/** The umber frame round the maze, the ochre of the Greek key on it, and the ends' discs. */
export const FRAME_COLOR = 0x4a2e1c;
export const KEY_COLOR = 0xd9b77a;
/**
 * Ariadne's thread, the path you draw, in the colour of linen, and its
 * darker edge. Its sandy colour keeps it well apart from the terracotta
 * walls, and the edge keeps it clear on the floor.
 */
export const THREAD_COLOR = 0xd5c19a;
export const THREAD_EDGE_COLOR = 0x9a7c4c;
/** The gold of the thread once you escape, its darker edge, the light that runs along it, and gold text that reads on paper. */
export const GOLD_COLOR = 0xe2b53c;
export const GOLD_EDGE_COLOR = 0x8a6512;
export const GOLD_GLOW_COLOR = 0xf8d77a;
export const GOLD_TEXT_COLOR = 0xa47812;
/** The clues' numbers, in a brown like clay, and a hidden clue's `?`, in the blue of the frescoes so it stands out from them. */
export const CLUE_COLOR = 0x5a3a22;
export const HIDDEN_CLUE_COLOR = 0x2f6f9f;
