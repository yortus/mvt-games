import { describe, expect, it } from 'vitest';
import { createMazeGrid } from './maze-grid';
import { compareWithBruteForce } from './maze-paths.test-support';

// Every 5 by 5 path, about half a second of work, too much to run on every
// save. maze-solver.test.ts checks the same on a 4 by 4.
describe('MazeSolver, on every 5 by 5 path', { timeout: 60_000 }, () => {
    // On a 5 by 5 grid, 7,992 of the 8,648 puzzles have one solution, as
    // counted by hand-checked brute force. The rules finish 7,248 of those, and
    // must find the path in every one, and never finish one of the rest.
    it('finds the one solution wherever its rules finish', () => {
        const [paths, unique, finished, wrong] = compareWithBruteForce(createMazeGrid({ rows: 5, cols: 5 }));
        expect({ paths, unique, finished, wrong }).toEqual({ paths: 8648, unique: 7992, finished: 7248, wrong: 0 });
    });
});
