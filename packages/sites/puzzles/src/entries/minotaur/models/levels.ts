import type { PuzzleLevel } from '../../../shared';

/** What makes a level of maze. Its name, and the levels' order, are the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size: as many rows as columns. */
    readonly size: number;
}

/** Every level's mazes are finished by the solver's rules alone, so each can be solved without a guess. The levels differ in size. */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 5 },
    medium: { size: 7 },
    hard: { size: 9 },
    expert: { size: 11 },
};
