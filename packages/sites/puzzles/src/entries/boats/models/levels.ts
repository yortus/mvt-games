import type { PuzzleLevel } from '../../../shared';
import type { BoatTechnique } from './boat-solver';

/** What makes a level of puzzle. Its name is one of the four every puzzle on the site has. */
export interface LevelSettings {
    /** The harbour's size: as many rows as columns. */
    readonly size: number;
    /** The length of every boat in the fleet, longest first. */
    readonly fleet: readonly number[];
    /** The hardest technique the player is expected to use. Givens are printed until that much finishes the puzzle. */
    readonly hardest: BoatTechnique;
    /** Whether every puzzle must need `hardest`, so the level is harder in kind than the one before. */
    readonly isHardestNeeded: boolean;
}

/** The levels, in order: all four every puzzle on the site has. */
export const BOAT_LEVELS: readonly PuzzleLevel[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * Each fleet fills about a fifth of its harbour, as the classic 10 by 10
 * puzzle's does. Each step up changes one or two things: Medium is bigger,
 * with a longer boat, and needs the fleet count, Hard is the classic
 * harbour and fleet, and Expert keeps them and needs the places.
 */
export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { size: 6, fleet: [3, 2, 2, 1, 1, 1], hardest: 'rules', isHardestNeeded: false },
    medium: { size: 8, fleet: [4, 3, 2, 2, 1, 1, 1], hardest: 'fleet', isHardestNeeded: true },
    hard: { size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hardest: 'fleet', isHardestNeeded: true },
    expert: { size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hardest: 'places', isHardestNeeded: true },
};
