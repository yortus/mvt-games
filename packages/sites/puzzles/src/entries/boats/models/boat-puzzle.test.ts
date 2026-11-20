import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { LEVEL_SETTINGS, BOAT_LEVELS } from './levels';
import { createBoatPuzzle } from './boat-puzzle';

describe('createBoatPuzzle', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (let i = 0; i < BOAT_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[BOAT_LEVELS[i]];
            // Counting a 10 by 10 harbour's solutions takes a while. So only the smaller harbours are counted here, and the slow test counts them all
            const isSolutionCounted = settings.size < 10;
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const found = checkPuzzle({ puzzle: createBoatPuzzle({ seed, settings }), settings, isSolutionCounted });
                for (let j = 0; j < found.length; j++) problems.push(`${BOAT_LEVELS[i]} ${seed}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    });
});

/** How many seeds each level is checked with. They are a sample, to keep the test within its time, and the slow test checks many. */
const SEEDS_PER_LEVEL = 3;
