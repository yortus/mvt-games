import type { PuzzleLevel } from '../../../shared';
import type { RiverTechnique } from './river-solver';

/** The settings for one level of puzzle, named for one of the four levels that every puzzle on the site has. */
export interface LevelSettings {
    /** The valley's size: as many rows as columns. */
    readonly size: number;
    /** The smallest share of the valley's cells that the river runs through, from 0 to 1. */
    readonly leastFill: number;
    /** The largest share of the valley's cells that the river runs through, from 0 to 1. */
    readonly mostFill: number;
    /** The hardest technique the player is expected to use. The maker prints givens until the techniques up to this one can finish the puzzle. */
    readonly hardest: RiverTechnique;
    /** Whether every puzzle must need `hardest`, so the level is harder in kind than the one before. */
    readonly isHardestNeeded: boolean;
}

/**
 * The settings for each level. The river runs through about half the valley
 * at every level. Each step up changes one thing. Medium is bigger, Hard
 * needs the loops, and Expert is bigger again and needs the crossings.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 6, leastFill: 0.4, mostFill: 0.55, hardest: 'rules', isHardestNeeded: false },
    medium: { size: 8, leastFill: 0.4, mostFill: 0.55, hardest: 'rules', isHardestNeeded: false },
    hard: { size: 8, leastFill: 0.4, mostFill: 0.55, hardest: 'loops', isHardestNeeded: true },
    expert: { size: 10, leastFill: 0.4, mostFill: 0.55, hardest: 'crossings', isHardestNeeded: true },
};
