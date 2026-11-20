import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { LEVEL_SETTINGS, RIVER_LEVELS } from './levels';
import { createRiverPuzzle } from './river-puzzle';

describe('createRiverPuzzle', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (let i = 0; i < RIVER_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[RIVER_LEVELS[i]];
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const found = checkPuzzle(createRiverPuzzle({ seed, settings }), settings);
                for (let j = 0; j < found.length; j++) problems.push(`${RIVER_LEVELS[i]} ${seed}: ${found[j]}`);
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

/** How many seeds each level is checked with: a sample, to keep within the test's time. The slow test checks many. */
const SEEDS_PER_LEVEL = 3;
