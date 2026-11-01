import type { PuzzleLevel } from '../models';

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** Every puzzle's screen, in pixels: tall, to suit a phone held upright. */
export const SCREEN_WIDTH = 540;
export const SCREEN_HEIGHT = 768;

/**
 * The side margin, and the width between the margins. The calendar, and
 * each puzzle's grid and buttons, line up on them.
 */
export const MARGIN = 18;
export const PAGE_WIDTH = SCREEN_WIDTH - MARGIN * 2;

// ---------------------------------------------------------------------------
// The calendar's screen
// ---------------------------------------------------------------------------

export const TITLE_Y = 34;
export const TAGLINE_Y = 70;

/** The tabs, one for each level, side by side across the page. */
export const TAB_Y = 96;
export const TAB_GAP = 6;
export const TAB_HEIGHT = 44;

/** The bar with the month's name, and the ways to the months before and after. */
export const MONTH_Y = 152;
export const MONTH_BUTTON_WIDTH = 56;

/** The days of the month, a week to a row, under the days of the week's names. */
export const WEEKDAY_Y = 216;
export const DAYS_Y = 232;
export const DAY_PITCH = PAGE_WIDTH / 7;
export const DAY_SIZE = DAY_PITCH - 6;

/** The count of days solved, along the bottom. */
export const FOOTER_Y = DAYS_Y + DAY_PITCH * 6 + 22;

// ---------------------------------------------------------------------------
// Colours: ink, pen and pencil on paper
// ---------------------------------------------------------------------------

export const PAPER_COLOR = 0xf3eee3;
export const CARD_COLOR = 0xfffdf8;
export const THIN_LINE_COLOR = 0xcfc6b4;
/** What the puzzle gives, in printer's ink, and what the player writes, in a pen's blue. */
export const INK_COLOR = 0x23211d;
export const ANSWER_COLOR = 0x2457b8;
export const PENCIL_COLOR = 0x6a6e78;
/** What breaks a rule, and the cell it is in. */
export const CLASH_COLOR = 0xc23b33;
export const CLASH_CELL_COLOR = 0xf6d8d1;
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

export const MONTH_NAMES: readonly string[] = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAY_NAMES: readonly string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Each level's name, as the calendar's tabs and a puzzle's title give it. */
export const LEVEL_NAMES: Readonly<Record<PuzzleLevel, string>> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** The text of each whole number from 0 to 400, made once, so a count's text never has to be built. */
export const NUMBER_TEXTS: readonly string[] = Array.from({ length: 401 }, (_, i) => String(i));

// ---------------------------------------------------------------------------
// The way in
// ---------------------------------------------------------------------------

/** The space for the example at the top of the card that says how to play. The card is as tall as all it holds. */
export const EXAMPLE_SIZE = 210;

/** The ring that shows a press being held, in the game and in the walkthrough's demos alike: its radius, in pixels, small enough for a key. */
export const HOLD_RING_RADIUS = 22;

/** The walkthrough's card, across the top of the screen. */
export const WALKTHROUGH_Y = 4;
export const WALKTHROUGH_HEIGHT = 74;
