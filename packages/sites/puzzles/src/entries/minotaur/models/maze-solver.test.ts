import { describe, expect, it } from 'vitest';
import { createMazeGrid } from './maze-grid';
import { compareWithBruteForce } from './maze-paths.test-support';

// A sample of what maze-solver.slow.test.ts checks on every 5 by 5 path.
describe('MazeSolver', () => {
    // Every path through every cell of a 4 by 4 grid is listed, and grouped by
    // its start, its end and its clues. A path alone in its group is the one
    // solution of its puzzle, and on a 4 by 4, every puzzle has one solution.
    // The rules finish every one of them, and must find that path each time.
    it('finds the one solution wherever its rules finish, on every path of a 4 by 4', () => {
        const [paths, unique, finished, wrong] = compareWithBruteForce(createMazeGrid({ rows: 4, cols: 4 }));
        expect({ paths, unique, finished, wrong }).toEqual({ paths: 552, unique: 552, finished: 552, wrong: 0 });
    });
});
