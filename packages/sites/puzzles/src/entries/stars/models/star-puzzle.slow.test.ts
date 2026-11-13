import { describe, expect, it } from 'vitest';
import { LEVEL_SETTINGS, STAR_LEVELS } from './levels';
import { createStarPuzzle } from './star-puzzle';
import { createStarSolver } from './star-solver';

// The unit test checks a couple of seeds at each level. This checks many,
// so a seed that would make a puzzle with two solutions, or at the wrong
// level, turns up.

describe('createStarPuzzle, over many seeds', () => {
    it('makes puzzles with one solution, at the reasoning asked for', () => {
        const problems: string[] = [];
        for (let i = 0; i < STAR_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[STAR_LEVELS[i]]!;
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const puzzle = createStarPuzzle({ seed: seed * 4 + i, settings });
                const solver = createStarSolver({ grid: puzzle.grid, regions: puzzle.regions });
                if (solver.countSolutions(2) !== 1 || solver.grade() !== settings.reasoning) problems.push(`${STAR_LEVELS[i]} ${seed}`);
            }
        }
        expect(problems).toEqual([]);
    }, 120_000);
});

const SEEDS_PER_LEVEL = 40;
