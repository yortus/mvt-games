import type { PuzzleLevel } from '../../../shared';
import type { MazeReasoning } from './maze-solver';

/** What makes a level of maze. Its name, and the levels' order, are the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size: as many rows as columns. */
    readonly size: number;
    /**
     * What its puzzles take to solve. A puzzle the rules alone solve is
     * never made at a level of tries, so that the harder levels are harder
     * in kind as well as in size.
     */
    readonly reasoning: Exclude<MazeReasoning, 'guessing'>;
}

export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 5, reasoning: 'rules' },
    medium: { size: 7, reasoning: 'rules' },
    hard: { size: 9, reasoning: 'tries' },
    expert: { size: 11, reasoning: 'tries' },
};
