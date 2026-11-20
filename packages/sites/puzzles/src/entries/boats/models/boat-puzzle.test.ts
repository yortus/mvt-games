import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { LEVEL_SETTINGS, BOAT_LEVELS } from './levels';
import { createBoatPuzzle } from './boat-puzzle';

describe('createBoatPuzzle', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (let i = 0; i < BOAT_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[BOAT_LEVELS[i]];
            // Counting a 10 by 10 harbour's solutions takes a while, so the small ones are counted here, and every one in the slow test
            const isCounted = settings.size < 10;
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const found = checkPuzzle(createBoatPuzzle({ seed, settings }), settings, isCounted);
                for (let j = 0; j < found.length; j++) problems.push(`${BOAT_LEVELS[i]} ${seed}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    });

    it('makes the same puzzle from the same seed', () => {
        const settings = LEVEL_SETTINGS.expert;
        const a = createBoatPuzzle({ seed: 3, settings });
        const b = createBoatPuzzle({ seed: 3, settings });
        expect([b.solution, b.givens]).toEqual([a.solution, a.givens]);
    });
});

/** How many seeds each level is checked with: a sample, to keep within the test's time. The slow test checks many. */
const SEEDS_PER_LEVEL = 3;
