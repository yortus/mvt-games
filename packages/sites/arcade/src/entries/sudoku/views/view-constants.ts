import type { Level } from '#sudoku-digger';

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** The screen's size in pixels: tall, to suit a phone held upright. */
export const SCREEN_WIDTH = 540;
export const SCREEN_HEIGHT = 768;

/** The side margin, which the grid, the tabs and the calendar line up on. */
export const MARGIN = 18;

// ---------------------------------------------------------------------------
// The puzzle's screen
// ---------------------------------------------------------------------------

/** A cell's size, and where the grid's top left corner is, in pixels. */
export const CELL_SIZE = 56;
export const GRID_SIZE = CELL_SIZE * 9;
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

/** The buttons under the keypad: undo, and the tutorial. */
export const TOOL_Y = KEYPAD_Y + KEY_HEIGHT + 12;
export const TOOL_GAP = 8;
export const TOOL_WIDTH = (GRID_SIZE - TOOL_GAP) / 2;
export const TOOL_HEIGHT = 48;

/** The line of help along the bottom. */
export const HINT_Y = TOOL_Y + TOOL_HEIGHT + 26;

// ---------------------------------------------------------------------------
// The calendar's screen
// ---------------------------------------------------------------------------

export const TITLE_Y = 34;
export const TAGLINE_Y = 70;

/** The tabs, one for each level. */
export const TAB_Y = 96;
export const TAB_GAP = 6;
export const TAB_WIDTH = (GRID_SIZE - TAB_GAP * 4) / 5;
export const TAB_HEIGHT = 44;

/** The bar with the month's name, and the ways to the months before and after. */
export const MONTH_Y = 152;
export const MONTH_BUTTON_WIDTH = 56;

/** The days of the month, a week to a row, under the days of the week's names. */
export const WEEKDAY_Y = 216;
export const DAYS_Y = 232;
export const DAY_PITCH = GRID_SIZE / 7;
export const DAY_SIZE = DAY_PITCH - 6;

/** The count of days solved, along the bottom. */
export const FOOTER_Y = DAYS_Y + DAY_PITCH * 6 + 22;

// ---------------------------------------------------------------------------
// Colours: ink and pencil on paper
// ---------------------------------------------------------------------------

export const PAPER_COLOR = 0xf3eee3;
export const CARD_COLOR = 0xfffdf8;
/** A given cell, a shade darker than the cells to fill in. */
export const GIVEN_CELL_COLOR = 0xeae3d4;
export const THIN_LINE_COLOR = 0xcfc6b4;
export const BOX_LINE_COLOR = 0x3b3832;
/** The givens, in printer's ink, and the player's answers, in a pen's blue. */
export const INK_COLOR = 0x23211d;
export const ANSWER_COLOR = 0x2457b8;
/** Pencil marks. */
export const PENCIL_COLOR = 0x6a6e78;
/** A digit that breaks a rule, and its cell. */
export const CLASH_COLOR = 0xc23b33;
export const CLASH_CELL_COLOR = 0xf6d8d1;
/** The cell the picker is choosing for. */
export const PICKING_CELL_COLOR = 0xd6e3fa;
/** The cells selected for notes, as if run over with a highlighter. */
export const SELECTED_CELL_COLOR = 0xfbeaa5;
/**
 * The group notes' colours, taken in turn, so notes side by side are told
 * apart: violet, teal, olive, slate and petrol. Each is dark enough for its
 * digits. None is warm, as reds and oranges read as errors and warnings,
 * and none is the answers' blue or the highlighter's yellow.
 */
export const GROUP_COLORS: readonly number[] = [0x6b47c2, 0x177a68, 0x52701c, 0x4b6478, 0x1d6a8f];
export const ACCENT_COLOR = 0x2f6fde;
/** The tick of a solved day, and the glow of a solved grid. */
export const SOLVED_COLOR = 0x2e9b5a;
export const SOLVED_GLOW_COLOR = 0xc9edd4;
export const DIM_TEXT_COLOR = 0x8c8576;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Text styles are white, and tinted to the colour they are shown in, so one style serves every colour. */
export const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: '600', fill: 0xffffff };
export const SMALL_STYLE = { fontFamily: FONT_FAMILY, fontSize: 15, fill: 0xffffff };

/** Each level's name, as the tabs and the puzzle's title give it. */
export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
    easiest: 'Easiest',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    hardest: 'Hardest',
};

export const MONTH_NAMES: readonly string[] = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAY_NAMES: readonly string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The text of each whole number from 0 to 400, made once, so a count's text never has to be built. */
export const NUMBER_TEXTS: readonly string[] = Array.from({ length: 401 }, (_, i) => String(i));
