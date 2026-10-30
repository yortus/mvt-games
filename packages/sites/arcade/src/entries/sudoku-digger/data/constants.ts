// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * How hard a puzzle is, from one a beginner can finish by spotting the one
 * digit that fits a cell, to one that needs guesswork.
 */
export type Level = 'easiest' | 'easy' | 'medium' | 'hard' | 'evil';

/** Every level, from the easiest to the hardest. */
export const LEVELS: readonly Level[] = ['easiest', 'easy', 'medium', 'hard', 'evil'];
