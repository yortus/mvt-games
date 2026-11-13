import { describe, expect, it } from 'vitest';
import { createMazeGrid } from './maze-grid';
import { compareWithBruteForce, createSolverFor, listEveryPath } from './maze-paths.test-support';

// Every 5 by 5 path, which takes seconds. maze-solver.test.ts checks a sample.
describe('MazeSolver, on every 5 by 5 path', { timeout: 60_000 }, () => {
    // On a 5 by 5 grid, 7,992 of the 8,648 puzzles have one solution, as
    // counted by hand-checked brute force.
    it('counts one solution exactly where brute force finds one', () => {
        expect(compareWithBruteForce(createMazeGrid({ rows: 5, cols: 5 }))).toEqual([8648, 7992, 8648]);
    });

    it('grades a maze it can solve without guessing only when it has one solution', () => {
        const grid = createMazeGrid({ rows: 5, cols: 5 });
        for (const path of listEveryPath(grid).slice(0, 2000)) {
            const solver = createSolverFor(grid, path);
            if (solver.grade() !== 'guessing') expect(solver.countSolutions(2)).toBe(1);
        }
    });

    it('finds mazes of every grade: by the rules alone, by tries, and by guessing', () => {
        const grid = createMazeGrid({ rows: 5, cols: 5 });
        const grades = new Set(listEveryPath(grid).map((path) => createSolverFor(grid, path).grade()));
        expect([...grades].sort()).toEqual(['guessing', 'rules', 'tries']);
    });
});
