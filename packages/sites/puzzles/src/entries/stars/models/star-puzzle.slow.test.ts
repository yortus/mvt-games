import { describe, expect, it } from 'vitest';
import { checkPuzzle } from './check-puzzle.test-support';
import { LEVEL_SETTINGS, STAR_LEVELS } from './levels';
import { createStarPuzzle } from './star-puzzle';

// The unit test checks a couple of seeds at each level. This checks many,
// so a seed whose puzzle has two solutions, a given it doesn't need, or the
// wrong technique, turns up.

describe('createStarPuzzle, over many seeds', () => {
    it('makes puzzles with one solution that each level\'s techniques finish from givens that are all needed', () => {
        const problems: string[] = [];
        for (let i = 0; i < STAR_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[STAR_LEVELS[i]];
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const found = checkPuzzle(createStarPuzzle({ seed: seed * 4 + i, settings }), settings);
                for (let j = 0; j < found.length; j++) problems.push(`${STAR_LEVELS[i]} ${seed}: ${found[j]}`);
            }
        }
        expect(problems).toEqual([]);
    }, 120_000);
});

const SEEDS_PER_LEVEL = 30;
