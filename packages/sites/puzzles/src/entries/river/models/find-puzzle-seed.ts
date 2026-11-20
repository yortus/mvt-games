import type { PuzzleLevel } from '../../../shared';

/**
 * Returns the seed of `day`'s puzzle at `level`. Every player's game works
 * out the same seed for the same day and level, so they all get the same
 * puzzle. The seeds must never change once players have puzzles made from
 * them. A player's progress is kept with its puzzle, and it is dropped if
 * the puzzle it was kept for is no longer the one made.
 */
export function findPuzzleSeed(day: number, level: PuzzleLevel): number {
    return day * SEEDS_PER_DAY + LEVEL_SEEDS[level];
}

/**
 * Each level's seed within a day. They are written out, rather than taken
 * from the levels' order, so that changing the order changes no puzzle.
 */
const LEVEL_SEEDS: Readonly<Record<PuzzleLevel, number>> = { easy: 0, medium: 1, hard: 2, expert: 3 };

/** How many seeds each day has, one for each level. */
const SEEDS_PER_DAY = 4;
