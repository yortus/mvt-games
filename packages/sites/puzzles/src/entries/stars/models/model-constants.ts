import { type PuzzleLevel, toDayNumber } from '../../../shared';
import { LEVEL_SETTINGS, type LevelSettings } from './levels';

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

/** The seed of the example on the How to play card, which shows it solved. Any seed would do. */
export const EXAMPLE_SEED = 5;

/** The example's settings. It is an easy puzzle, so it is small and quick to make. */
export const EXAMPLE_SETTINGS: LevelSettings = LEVEL_SETTINGS.easy;

/** The seed of the walkthrough's practice puzzle. Any seed would do, other than the example's. */
export const PRACTICE_SEED = 7;

/** The practice puzzle's settings. It is an easy puzzle, since the walkthrough teaches the controls, not the techniques. */
export const PRACTICE_SETTINGS: LevelSettings = LEVEL_SETTINGS.easy;
