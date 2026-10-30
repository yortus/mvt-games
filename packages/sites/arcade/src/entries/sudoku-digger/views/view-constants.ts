import type { Level } from '../data';

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 480;

/** A cell's size, and where the grid's top left corner is, in pixels. */
export const CELL_SIZE = 44;
export const GRID_X = 30;
export const GRID_Y = 26;
export const GRID_SIZE = CELL_SIZE * 9;

/** The panel beside the grid, where the phases, the caption and the counts are. */
export const PANEL_X = 446;
export const PANEL_WIDTH = 182;

/** The row of buttons along the bottom. */
export const BUTTON_Y = 436;
export const BUTTON_WIDTH = 56;
export const BUTTON_HEIGHT = 32;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

export const BACKGROUND_COLOR = 0x0d1117;
export const CELL_COLOR = 0x1b2430;
/** The row and column of the cell being dug. */
export const PEER_COLOR = 0x222f3e;
/** The cells a step of the grader's reasoning rests on. */
export const HIGHLIGHT_COLOR = 0x264d73;
/** A cell dug out: a hole, darker than the rest. */
export const DUG_COLOR = 0x10151c;
/** A cell that must stay, as another digit would give a second solution: a calm teal, as it keeps the puzzle sound. */
export const NEEDED_COLOR = 0x1d4a46;
/** The pulse of a cell as it is found needed, which settles into its own colour. */
export const NEEDED_PULSE_COLOR = 0x3fb9a8;
/** A cell held, as its row or column can spare no more givens. */
export const HELD_COLOR = 0x323a46;
export const THIN_LINE_COLOR = 0x30404f;
export const BOX_LINE_COLOR = 0x8aa2bc;
export const FOCUS_COLOR = 0xf2cc60;

/** The digits, by where they came from. */
export const GIVEN_COLOR = 0xe6edf3;
export const SEARCH_COLOR = 0x58a6ff;
export const TEST_COLOR = 0xf0883e;
export const LOGIC_COLOR = 0x7ee787;
export const MARK_COLOR = 0x8b949e;
/** Pencil marks just rubbed out, and the flash of a dead end. */
export const RUBBED_OUT_COLOR = 0xff7b72;
/** The flash of a cell dug out. */
export const DUG_FLASH_COLOR = 0xe3b341;

export const TEXT_COLOR = 0xc9d1d9;
export const DIM_TEXT_COLOR = 0x6e7681;
export const WARNING_COLOR = 0xff7b72;

/** Each level's name, as the captions and the buttons give it. */
export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
    easiest: 'Easiest',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    evil: 'Evil',
};

/** The text of each whole number from 0 to 100, made once, so a count's text never has to be built. */
export const NUMBER_TEXTS: readonly string[] = Array.from({ length: 101 }, (_, i) => String(i));
