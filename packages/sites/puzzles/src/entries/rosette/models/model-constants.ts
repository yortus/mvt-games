import { type PuzzleLevel, toDayNumber } from '../../../shared';
import type { LevelSettings } from './levels';
import type { FrameKind } from './trace-frame';

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

/** How many swaps undo can take back, at most. */
export const MOST_UNDOS = 500;

/** The small picture the card that says how to play shows, solved: the seed it is made from, its settings, and its frame. */
export const EXAMPLE_SEED = 11;
export const EXAMPLE_SETTINGS: LevelSettings = { tiles: 30, closestPair: 0.035, symmetries: [5] };
export const EXAMPLE_FRAME: FrameKind = 'round-arch';

/** The walkthrough's practice picture: the seed it is made from, its settings, and its frame. Any seed would do, other than the example's. */
export const PRACTICE_SEED = 7;
export const PRACTICE_SETTINGS: LevelSettings = { tiles: 22, closestPair: 0.04, symmetries: [5] };
export const PRACTICE_FRAME: FrameKind = 'rectangle';
