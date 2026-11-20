import type { PuzzleLevel } from '../../../shared';

/** What makes a level of maze. Its name, and the levels' order, are the four every puzzle on the site has. */
export interface LevelSettings {
    /** The grid's size, as many rows as columns. */
    readonly size: number;
    /**
     * How many clues each maze hides, at most. The maker hides only clues
     * that the rules can do without, so a maze often hides fewer.
     */
    readonly mostHiddenClues: number;
}

/**
 * Every level's mazes are finished by the solver's rules alone, so each can
 * be solved without a guess. Easy and Medium show every clue. Hard hides 3
 * of its 16, and Expert 4 of its 20, about the same share. Hiding every clue
 * the rules can do without, six to eight at Expert, makes a maze too hard to
 * solve by hand.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 5, mostHiddenClues: 0 },
    medium: { size: 7, mostHiddenClues: 0 },
    hard: { size: 9, mostHiddenClues: 3 },
    expert: { size: 11, mostHiddenClues: 4 },
};
