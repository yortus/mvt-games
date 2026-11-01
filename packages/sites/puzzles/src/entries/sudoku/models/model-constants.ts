import { type PuzzleLevel, toDayNumber } from '../../../shared';
import type { Level } from '../generator';

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

/** The first day with puzzles. The calendar goes back no further. */
export const FIRST_DAY = toDayNumber({ year: 2026, month: 1, day: 1 });

/** The level a new player starts on. After that, the level they last chose. */
export const STARTING_LEVEL: PuzzleLevel = 'easy';

/**
 * The puzzle maker's level for each of the game's. The maker has five, from
 * Easiest to Hardest, which Sudoku Digger shows. The game has the four every
 * puzzle on the site has, and leaves the maker's Easiest out.
 */
export const GENERATOR_LEVELS: Readonly<Record<PuzzleLevel, Level>> = { easy: 'easy', medium: 'medium', hard: 'hard', expert: 'hardest' };

/** The game's levels it once named otherwise: Expert was Hardest, and its players' records and saves are still read. */
export const FORMER_LEVEL_NAMES: Readonly<Record<string, PuzzleLevel>> = { hardest: 'expert' };

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

/** How many actions undo can take back, at most. */
export const MOST_UNDOS = 200;

/** The walkthrough's practice puzzle: the seed it is made from, and its level. Any seed would do; this one is easy on the eye. */
export const PRACTICE_SEED = 7;
export const PRACTICE_LEVEL: Level = 'easiest';

/** The puzzle the card that says how to play shows, filled in. Any seed would do, other than the practice puzzle's. */
export const EXAMPLE_SEED = 3;
export const EXAMPLE_LEVEL: Level = 'easiest';
