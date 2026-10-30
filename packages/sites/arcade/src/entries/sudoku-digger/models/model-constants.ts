import type { Level } from '../data';
import type { Technique } from './logic-grader';
import type { DigOrderKind } from './write-dig-order';

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * How a level's puzzles are dug. The paper this demo follows sets each
 * level's givens, and its fewest in a line, and digs the harder levels in
 * more orderly orders. Its levels rarely come out as asked, so these are
 * set instead to make a puzzle of each level often, as measured: one in
 * every one to two tries for Easiest, Easy and Evil, and about one in
 * fifteen for Medium and Hard.
 */
export interface LevelSettings {
    /** The fewest and the most givens a puzzle keeps. Each puzzle picks its target between them, at random. */
    readonly fewestGivens: number;
    readonly mostGivens: number;
    /** The fewest givens any row or column keeps. */
    readonly fewestPerLine: number;
    /** The order the cells are visited in for digging. */
    readonly digOrder: DigOrderKind;
}

export const LEVEL_SETTINGS: Readonly<Record<Level, LevelSettings>> = {
    easiest: { fewestGivens: 50, mostGivens: 54, fewestPerLine: 5, digOrder: 'random' },
    easy: { fewestGivens: 28, mostGivens: 31, fewestPerLine: 2, digOrder: 'random' },
    medium: { fewestGivens: 24, mostGivens: 28, fewestPerLine: 1, digOrder: 'snake' },
    hard: { fewestGivens: 22, mostGivens: 27, fewestPerLine: 0, digOrder: 'reading' },
    evil: { fewestGivens: 22, mostGivens: 25, fewestPerLine: 0, digOrder: 'random' },
};

/**
 * The level a puzzle comes out at, from the hardest technique it needs. Any
 * pair or triple makes it Hard. A puzzle that needs guesswork is Evil.
 */
export const TECHNIQUE_LEVEL: Readonly<Record<Technique, Level>> = {
    'naked-single': 'easiest',
    'hidden-single': 'easy',
    'locked-candidates': 'medium',
    'naked-pair': 'hard',
    'hidden-pair': 'hard',
    'naked-triple': 'hard',
};

// ---------------------------------------------------------------------------
// Making a grid
// ---------------------------------------------------------------------------

/** How many random digits are placed before the search fills the rest. The paper found 11 the best. */
export const SEED_COUNT = 11;
/** How many moves the search may take to fill the grid before it gives up and seeds a new one. */
export const FILL_MOVE_BUDGET = 400;
/** How many times the grid is shuffled once it is dug. */
export const SHUFFLE_COUNT = 4;
/**
 * The most puzzles tried out of sight for one shown. If none comes out at
 * the level asked for by then, the nearest is shown.
 */
export const MAX_GRIDS_TRIED = 100;

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

// How long each kind of step holds the screen at normal speed, in ms, so it
// can be seen. The search's moves start slow and speed up, so a long search
// soon blurs past.

/** A puzzle tried out of sight, and the one chosen, which holds longer, as its making is shown next. */
export const GRID_TRIED_MS = 150;
export const GRID_CHOSEN_MS = 1800;
export const SEED_MS = 220;
/** The first move of a search, when filling the grid. */
export const FILL_MOVE_MS = 30;
/** The first move of a search, when testing whether a cell can be dug. */
export const TEST_MOVE_MS = 20;
/** Each move of a search takes this much of the time of the one before. */
export const MOVE_SPEED_UP = 0.97;
/** The shortest time a move of a search takes. */
export const FASTEST_MOVE_MS = 0.4;
export const GAVE_UP_MS = 1400;
export const FILLED_MS = 1000;
export const DIG_CHOSEN_MS = 130;
export const DIG_HELD_MS = 450;
export const DIG_ENDED_MS = 1500;
export const DIG_TESTING_MS = 260;
export const DIG_TEST_FAILED_MS = 160;
export const DIG_DUG_MS = 220;
export const DIG_NEEDED_MS = 900;
export const SHUFFLE_MS = 1100;
export const MARKED_MS = 1500;
/** How long each technique's step holds the screen: a quick one for a single, longer for the others, which take some reading. */
export const TECHNIQUE_MS = {
    'naked-single': 140,
    'hidden-single': 380,
    'locked-candidates': 1500,
    'naked-pair': 1500,
    'hidden-pair': 1500,
    'naked-triple': 1500,
} as const;
export const STUCK_MS = 1600;
export const FINISHED_MS = 7000;

/** How many times as fast as normal each playback runs. */
export const PLAYBACK_RATE = {
    paused: 0,
    slow: 0.25,
    normal: 1,
    fast: 4,
} as const;
