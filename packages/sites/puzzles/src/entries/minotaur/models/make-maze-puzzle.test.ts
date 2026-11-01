import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../../shared';
import { drawRandomPath } from './draw-random-path';
import { PASSAGE } from './edge-states';
import { LEVEL_SETTINGS } from './levels';
import { makeMazePuzzle, type MazePuzzle } from './make-maze-puzzle';
import { createMazeGrid } from './maze-grid';
import { createMazeSolver } from './maze-solver';
import { createRandom } from './random';
import { readClues } from './read-clues';

describe('drawRandomPath', () => {
    it('draws a path through every cell once, a step at a time, the same for the same seed', () => {
        const grid = createMazeGrid({ rows: 6, cols: 6 });
        const path = drawRandomPath({ grid, random: createRandom({ seed: 3 }) });
        expect(new Set(path).size).toBe(36);
        for (let i = 0; i + 1 < path.length; i++) expect(grid.edgeBetween(path[i], path[i + 1])).toBeGreaterThanOrEqual(0);
        expect(drawRandomPath({ grid, random: createRandom({ seed: 3 }) })).toEqual(path);
        expect(drawRandomPath({ grid, random: createRandom({ seed: 4 }) })).not.toEqual(path);
    });

    it('leaves the snake it starts from far behind', () => {
        // A snake runs straight along each row. A well-mixed path turns at about half its cells
        const grid = createMazeGrid({ rows: 11, cols: 11 });
        const random = createRandom({ seed: 1 });
        let turns = 0;
        let steps = 0;
        for (let i = 0; i < 20; i++) {
            const path = drawRandomPath({ grid, random });
            for (let j = 1; j + 1 < path.length; j++) {
                steps++;
                if (path[j] - path[j - 1] !== path[j + 1] - path[j]) turns++;
            }
        }
        expect(turns / steps).toBeGreaterThan(0.4);
        expect(turns / steps).toBeLessThan(0.7);
    });
});

describe('makeMazePuzzle', () => {
    for (const level of PUZZLE_LEVELS) {
        it(`makes a ${level} puzzle of its size, with one solution, that takes its reasoning`, () => {
            const settings = LEVEL_SETTINGS[level];
            for (let seed = 0; seed < 3; seed++) {
                const puzzle = makeMazePuzzle({ seed, settings });
                expect([puzzle.grid.rows, puzzle.grid.cols]).toEqual([settings.size, settings.size]);
                expectPathFromStartToEnd(puzzle);
                expect(readClues(puzzle.grid, puzzle.solution)).toEqual(puzzle.clues);
                const solver = createMazeSolver(puzzle);
                expect(solver.grade()).toBe(settings.reasoning);
                expect(solver.countSolutions(2)).toBe(1);
            }
        });
    }

    it('makes the same puzzle from the same seed', () => {
        const settings = LEVEL_SETTINGS.medium;
        expect(toParts(makeMazePuzzle({ seed: 9, settings }))).toEqual(toParts(makeMazePuzzle({ seed: 9, settings })));
        expect(toParts(makeMazePuzzle({ seed: 9, settings }))).not.toEqual(toParts(makeMazePuzzle({ seed: 10, settings })));
    });

    /** What the puzzle is: its ends, its clues and its solution. */
    function toParts(puzzle: MazePuzzle): unknown {
        return { start: puzzle.start, end: puzzle.end, clues: puzzle.clues, solution: Array.from(puzzle.solution) };
    }
});

/** Checks that the solution's passages make one path from the start to the end through every cell. */
function expectPathFromStartToEnd(puzzle: MazePuzzle): void {
    const { grid, start, end, solution } = puzzle;
    const visited = new Set<number>([start]);
    let previous = -1;
    let cell = start;
    while (cell !== end) {
        let next = -1;
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge < 0 || solution[edge] !== PASSAGE) continue;
            const other = grid.edgeCellA[edge] === cell ? grid.edgeCellB[edge] : grid.edgeCellA[edge];
            if (other !== previous) next = other;
        }
        expect(next).toBeGreaterThanOrEqual(0);
        expect(visited.has(next)).toBe(false);
        visited.add(next);
        previous = cell;
        cell = next;
    }
    expect(visited.size).toBe(grid.cellCount);
}
