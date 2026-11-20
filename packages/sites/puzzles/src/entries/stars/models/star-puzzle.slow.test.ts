import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, STAR_LEVELS } from './levels';
import { FIRST_DAY } from './model-constants';
import { createStarPuzzle } from './star-puzzle';

// The unit test checks a couple of seeds at each level. This checks the
// puzzles players get on many days, so a day whose puzzle has two
// solutions, a given it doesn't need, or the wrong technique, turns up.

describe('createStarPuzzle, over many days', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (const level of STAR_LEVELS) {
            const settings = LEVEL_SETTINGS[level];
            for (let day = FIRST_DAY; day < FIRST_DAY + DAYS_CHECKED; day++) {
                const found = checkPuzzle(createStarPuzzle({ seed: findPuzzleSeed(day, level), settings }), settings);
                for (let j = 0; j < found.length; j++) problems.push(`${level}, day ${day}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    }, 120_000);
});

/** How many days are checked at each level, from the first. */
const DAYS_CHECKED = 30;
