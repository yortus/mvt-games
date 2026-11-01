/**
 * How hard a puzzle is, the same four levels in every game on the site, so a
 * player knows what to expect from each. A game decides what each level means
 * for its own puzzles: their size, or the reasoning they take. A level's
 * name is part of its puzzles' names in the player's browser, so none may
 * change.
 */
export type PuzzleLevel = 'easy' | 'medium' | 'hard' | 'expert';

/** The levels, easiest first, as the calendar's tabs show them. */
export const PUZZLE_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium', 'hard', 'expert'];
