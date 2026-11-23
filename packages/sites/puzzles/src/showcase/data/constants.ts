import { toDayNumber } from '../../shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Every length in the paper's world is in metres. The paper lies on a desk,
// its spine along z, with the tops of its pages toward -z. Positions on a
// page are fractions of the page: across from its left edge, and down from
// its top.

/** The paper's name, on its masthead and at the top of every page. */
export const PAPER_NAME = 'The Daily Fold';

/** One page, as it lies on the desk. Two side by side make a spread. */
export const PAGE_WIDTH = 0.4;
export const PAGE_HEIGHT = 0.58;

/** The day of the paper's first edition. Each day after it has the next edition. */
export const FIRST_EDITION_DAY = toDayNumber({ year: 2026, month: 1, day: 1 });

/** How long a page takes to turn. */
export const TURN_MS = 700;
/** How long the reader takes to lean in to a puzzle, or back from it. */
export const LEAN_MS = 450;

/**
 * Every inside page's grid: its margins, and six columns with gutters
 * between them, as fractions of the page. The top margin holds the running
 * head, the line with the paper's name, the date and the page's number.
 */
export const SIDE_MARGIN = 0.05;
export const TOP_MARGIN = 0.075;
export const BOTTOM_MARGIN = 0.03;
export const COLUMN_COUNT = 6;
export const GUTTER = 0.015;
/** The band over a puzzle's box, which holds its name, as a fraction of the page's height. */
export const PUZZLE_TITLE_HEIGHT = 0.04;
/**
 * Where the grid for noughts and crosses is pencilled on the back page, over
 * the story at the left of its middle row. It's square, and these are
 * fractions of the page: its left edge and its side, across, and its top,
 * down.
 */
export const MARGIN_GRID_X = 0.07;
export const MARGIN_GRID_Y = 0.5;
export const MARGIN_GRID_SIZE = 0.22;
/** How many columns a puzzle's box spans. */
export const PUZZLE_COLUMNS = 4;
/** The front page's masthead, the paper's name in large type, and the line under it with the date. */
export const MASTHEAD_HEIGHT = 0.15;
export const DATELINE_HEIGHT = 0.035;
