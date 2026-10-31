import type { Level } from '#sudoku-digger';

/**
 * Returns the seed of `day`'s puzzle at `level`. Every player's game works
 * out the same seed for the same day and level, so they all get the same
 * puzzle. The seeds must never change once players have puzzles made from
 * them: a player's progress is kept with its puzzle's givens, and is dropped
 * if the puzzle it was kept for is no longer the one made.
 */
export function findPuzzleSeed(day: number, level: Level): number {
    return day * SEEDS_PER_DAY + LEVEL_SEEDS[level];
}

/**
 * Each level's seed within a day. They are written out, rather than taken
 * from the levels' order, so that changing the order changes no puzzle. A
 * level added later needs seeds of its own, outside these.
 */
const LEVEL_SEEDS: Readonly<Record<Level, number>> = { easiest: 0, easy: 1, medium: 2, hard: 3, hardest: 4 };
const SEEDS_PER_DAY = 5;
