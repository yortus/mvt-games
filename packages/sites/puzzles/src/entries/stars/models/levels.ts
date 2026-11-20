import type { PuzzleLevel } from '../../../shared';
import type { StarTechnique } from './star-solver';

/** What makes a level of puzzle. Its name is one of the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size: as many rows as columns, and as many regions. */
    readonly size: number;
    /** The hardest technique the player is expected to use. Givens are printed until that much finishes the puzzle. */
    readonly hardest: StarTechnique;
    /** Whether every puzzle must need `hardest`, so the level is harder in kind than the one before. */
    readonly isHardestNeeded: boolean;
}

/** The levels, in order: all four every puzzle on the site has. */
export const STAR_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * Every level has two stars a line, as every puzzle does. Each step up
 * changes one thing: Medium needs pressure, which Easy never does, Hard is
 * bigger, and Expert is bigger again and needs 2x2 boxes. 8 by 8 is the
 * smallest grid two stars a line fit in.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 8, hardest: 'bands', isHardestNeeded: false },
    medium: { size: 8, hardest: 'pressure', isHardestNeeded: true },
    hard: { size: 9, hardest: 'pressure', isHardestNeeded: true },
    expert: { size: 10, hardest: 'boxes', isHardestNeeded: true },
};
