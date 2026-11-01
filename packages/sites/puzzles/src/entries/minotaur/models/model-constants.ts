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

/** How many strokes undo can take back, at most. */
export const MOST_UNDOS = 200;

/** The small maze the card that says how to play shows, solved: the seed it is made from, and its size. Any seed would do; this one is easy to follow. */
export const EXAMPLE_SEED = 5;
export const EXAMPLE_SETTINGS: LevelSettings = { size: 4, reasoning: 'rules' };

/** The walkthrough's practice maze: the seed it is made from, and its size. Any seed would do, other than the example's. */
export const PRACTICE_SEED = 7;
export const PRACTICE_SETTINGS: LevelSettings = { size: 5, reasoning: 'rules' };
