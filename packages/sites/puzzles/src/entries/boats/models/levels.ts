import type { PuzzleLevel } from '../../../shared';
import type { BoatTechnique } from './boat-solver';

/** The settings for one level of puzzle. Every puzzle on the site has the same four levels. */
export interface LevelSettings {
    /** How many rows the harbour has. It has as many columns. */
    readonly size: number;
    /** The length of every boat in the fleet, longest first. */
    readonly fleet: readonly number[];
    /** The hardest technique the player is expected to use. The maker prints givens until the techniques up to this one can finish the puzzle. */
    readonly hardest: BoatTechnique;
    /** Whether every puzzle must need `hardest`, so the level is harder in kind than the one before. */
    readonly isHardestNeeded: boolean;
}

/** The levels, from easiest to hardest. Every puzzle on the site has these four. */
export const BOAT_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * Each fleet fills a fifth to just over a quarter of its harbour. Medium is
 * bigger than Easy, has a longer boat, and needs the `fleet` technique. Hard
 * has the classic puzzle's 10 by 10 harbour and fleet. Expert keeps them,
 * and needs the `places` technique.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 6, fleet: [3, 2, 2, 1, 1, 1], hardest: 'rules', isHardestNeeded: false },
    medium: { size: 8, fleet: [4, 3, 2, 2, 1, 1, 1], hardest: 'fleet', isHardestNeeded: true },
    hard: { size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hardest: 'fleet', isHardestNeeded: true },
    expert: { size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hardest: 'places', isHardestNeeded: true },
};
