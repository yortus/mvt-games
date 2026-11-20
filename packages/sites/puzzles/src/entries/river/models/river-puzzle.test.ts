import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../../shared';
import { checkPuzzle } from './check-puzzle.test-support';
import { LEVEL_SETTINGS } from './levels';
import { createRiverPuzzle } from './river-puzzle';

describe('createRiverPuzzle', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (let i = 0; i < PUZZLE_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[PUZZLE_LEVELS[i]];
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const found = checkPuzzle(createRiverPuzzle({ seed, settings }), settings);
                for (let j = 0; j < found.length; j++) problems.push(`${PUZZLE_LEVELS[i]} ${seed}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    });

    it('makes the same puzzle from the same seed', () => {
        const settings = LEVEL_SETTINGS.expert;
        const a = createRiverPuzzle({ seed: 3, settings });
        const b = createRiverPuzzle({ seed: 3, settings });
        expect([b.solutionEdges, b.givens]).toEqual([a.solutionEdges, a.givens]);
    });
});

/** How many seeds each level is checked with. It is a small sample, so the test stays within its time limit. The slow test beside it checks many days' puzzles. */
const SEEDS_PER_LEVEL = 3;
