import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../../shared';
import { checkPuzzle } from './check-puzzle.test-support';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS } from './levels';
import { FIRST_DAY } from './model-constants';
import { createRiverPuzzle } from './river-puzzle';

// The unit test checks a few seeds at each level. This test checks the
// puzzles that players get on many days, which takes too long for a unit
// test. It finds any day whose puzzle has two solutions, a given it doesn't
// need, or the wrong technique.

describe('createRiverPuzzle, over many days', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (const level of PUZZLE_LEVELS) {
            const settings = LEVEL_SETTINGS[level];
            for (let day = FIRST_DAY; day < FIRST_DAY + DAYS_CHECKED; day++) {
                const found = checkPuzzle(createRiverPuzzle({ seed: findPuzzleSeed(day, level), settings }), settings);
                for (let j = 0; j < found.length; j++) problems.push(`${level}, day ${day}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    });
});

/** How many days are checked at each level, from the first. */
const DAYS_CHECKED = 30;
