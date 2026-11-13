import { type PuzzleLevel, toDayNumber } from '../../../shared';
import type { LevelSettings } from './levels';

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

/** The first day with puzzles. The calendar goes back no further. */
export const FIRST_DAY = toDayNumber({ year: 2026, month: 1, day: 1 });

/** The level a new player starts on. After that, the level they last chose. */
export const STARTING_LEVEL: PuzzleLevel = 'easy';

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

/** How many actions undo can take back, at most. */
export const MOST_UNDOS = 200;

/** The puzzle the card that says how to play shows, solved: the seed it is made from, and its settings. Any seed would do. */
export const EXAMPLE_SEED = 5;
export const EXAMPLE_SETTINGS: LevelSettings = { size: 9, reasoning: 'look-ahead' };

/** The walkthrough's practice puzzle: the seed it is made from, and its settings. Any seed would do, other than the example's. */
export const PRACTICE_SEED = 7;
export const PRACTICE_SETTINGS: LevelSettings = { size: 9, reasoning: 'look-ahead' };
