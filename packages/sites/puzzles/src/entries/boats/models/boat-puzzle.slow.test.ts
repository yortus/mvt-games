import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, BOAT_LEVELS } from './levels';
import { FIRST_DAY } from './model-constants';
import { createBoatPuzzle } from './boat-puzzle';

// The unit test checks a few seeds at each level, and counts the solutions
// of the small harbours only. This test checks the puzzles that players get
// on many days, and counts the solutions of every one. So you'll find out
// if a day's puzzle has two solutions, a given it doesn't need, or the wrong
// hardest technique.

describe('createBoatPuzzle, over many days', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (const level of BOAT_LEVELS) {
            const settings = LEVEL_SETTINGS[level];
            for (let day = FIRST_DAY; day < FIRST_DAY + DAYS_CHECKED; day++) {
                const puzzle = createBoatPuzzle({ seed: findPuzzleSeed(day, level), settings });
                const found = checkPuzzle({ puzzle, settings, isSolutionCounted: true });
                for (let j = 0; j < found.length; j++) problems.push(`${level}, day ${day}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    }, 120_000);
});

/** How many days are checked at each level, from the first. */
const DAYS_CHECKED = 30;
