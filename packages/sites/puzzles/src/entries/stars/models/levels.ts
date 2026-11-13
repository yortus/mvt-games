import type { PuzzleLevel } from '../../../shared';
import type { StarReasoning } from './star-solver';

/** What makes a level of puzzle. Its name is one of the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size: as many rows as columns, and as many regions. */
    readonly size: number;
    /**
     * What its puzzles take to solve. A puzzle that one look ahead solves is
     * never made at a level of deep looks, so the harder level is harder in
     * kind.
     */
    readonly reasoning: Exclude<StarReasoning, 'guessing'>;
}

/**
 * The levels Stars has so far, in order. Both are 9 by 9, the smallest grid
 * that two stars a line fit fairly. Hard and Expert wait for bigger grids,
 * which take a faster puzzle maker.
 */
export const STAR_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium'];

export const LEVEL_SETTINGS: Readonly<Partial<Record<PuzzleLevel, LevelSettings>>> = {
    easy: { size: 9, reasoning: 'look-ahead' },
    medium: { size: 9, reasoning: 'deep-look-ahead' },
};
