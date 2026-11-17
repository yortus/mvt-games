import type { PuzzleLevel } from '../../../shared';
import type { StarTechnique } from './star-solver';

/** What makes a level of puzzle. Its name is one of the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size: as many rows as columns, and as many regions. */
    readonly size: number;
    /** How many stars every row, column and region holds: one or two. */
    readonly starsPerLine: number;
    /** The hardest technique the player is expected to use. Givens are printed until that much finishes the puzzle. */
    readonly hardest: StarTechnique;
    /** Whether every puzzle must need `hardest`, so the level is harder in kind than the one before. */
    readonly isHardestNeeded: boolean;
}

/** The levels, in order: all four every puzzle on the site has. */
export const STAR_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * Easy and Medium have one star a line, on smaller grids. Hard and Expert
 * have two, on bigger ones, and need pressure and 2x2 boxes in turn.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 6, starsPerLine: 1, hardest: 'bands', isHardestNeeded: false },
    medium: { size: 8, starsPerLine: 1, hardest: 'bands', isHardestNeeded: true },
    hard: { size: 9, starsPerLine: 2, hardest: 'pressure', isHardestNeeded: true },
    expert: { size: 10, starsPerLine: 2, hardest: 'boxes', isHardestNeeded: true },
};
