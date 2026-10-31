import type { Level } from '#sudoku-digger';
import { toDayNumber } from './day-numbers';

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

/** The first day with puzzles. The calendar goes back no further. */
export const FIRST_DAY = toDayNumber({ year: 2026, month: 1, day: 1 });

/** The level a new player starts on. After that, the level they last chose. */
export const STARTING_LEVEL: Level = 'easy';

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

/** How many actions undo can take back, at most. */
export const MOST_UNDOS = 200;

/** The tutorial's practice puzzle: the seed it is made from, and its level. Any seed would do; this one is easy on the eye. */
export const PRACTICE_SEED = 7;
export const PRACTICE_LEVEL: Level = 'easiest';
