import { describe, expect, it } from 'vitest';
import { createMazeGrid } from './maze-grid';
import { compareWithBruteForce, createSolverFor, listEveryPath } from './maze-paths.test-support';

// A sample of what maze-solver.slow.test.ts checks on every 5 by 5 path.
describe('MazeSolver', () => {
    // Every path through every cell of a 4 by 4 grid is listed, and grouped by
    // its start, its end and its clues. A path alone in its group is the one
    // solution of its puzzle, and on a 4 by 4, every puzzle has one solution.
    // The solver must agree about every path.
    it('counts one solution exactly where brute force finds one, on every path of a 4 by 4', () => {
        expect(compareWithBruteForce(createMazeGrid({ rows: 4, cols: 4 }))).toEqual([552, 552, 552]);
    });

    it('grades a maze it can solve without guessing only when it has one solution, on the first 5 by 5 paths', () => {
        const grid = createMazeGrid({ rows: 5, cols: 5 });
        for (const path of listEveryPath(grid).slice(0, 200)) {
            const solver = createSolverFor(grid, path);
            if (solver.grade() !== 'guessing') expect(solver.countSolutions(2)).toBe(1);
        }
    });
});
