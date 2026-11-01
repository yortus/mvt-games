import { describe, expect, it } from 'vitest';
import { PASSAGE } from './edge-states';
import { createMazeGrid, type MazeGrid } from './maze-grid';
import { createMazeSolver } from './maze-solver';
import { readClues } from './read-clues';

describe('MazeSolver', () => {
    // Every path through every cell of a small grid is listed, and grouped by
    // its start, its end and its clues. A path alone in its group is the one
    // solution of its puzzle. The solver must agree about every path. On a
    // 4 by 4 grid every puzzle has one solution, and on a 5 by 5, 7,992 of
    // the 8,648 do, as counted by hand-checked brute force.
    it('counts one solution exactly where brute force finds one, on every path of a 4 by 4 and a 5 by 5', { timeout: 60_000 }, () => {
        for (const [size, paths, unique] of [[4, 552, 552], [5, 8648, 7992]]) {
            const grid = createMazeGrid({ rows: size, cols: size });
            const all = listEveryPath(grid);
            const groups = new Map<string, number>();
            for (const path of all) groups.set(describePuzzle(grid, path), (groups.get(describePuzzle(grid, path)) ?? 0) + 1);
            let agreed = 0;
            let alone = 0;
            for (const path of all) {
                const isAlone = groups.get(describePuzzle(grid, path)) === 1;
                if (isAlone) alone++;
                const solutions = solverFor(grid, path).countSolutions(2);
                if ((solutions === 1) === isAlone) agreed++;
            }
            expect([all.length, alone, agreed]).toEqual([paths, unique, paths]);
        }
    });

    it('grades a maze it can solve without guessing only when it has one solution', () => {
        const grid = createMazeGrid({ rows: 5, cols: 5 });
        for (const path of listEveryPath(grid).slice(0, 2000)) {
            const solver = solverFor(grid, path);
            if (solver.grade() !== 'guessing') expect(solver.countSolutions(2)).toBe(1);
        }
    });

    it('finds mazes of every grade among the 5 by 5 paths: by the rules alone, by tries, and by guessing', () => {
        const grid = createMazeGrid({ rows: 5, cols: 5 });
        const grades = new Set(listEveryPath(grid).map((path) => solverFor(grid, path).grade()));
        expect([...grades].sort()).toEqual(['guessing', 'rules', 'tries']);
    });
});

/** Every path through every cell of `grid`, from every start, as its cells in order. */
function listEveryPath(grid: MazeGrid): number[][] {
    const paths: number[][] = [];
    const isOnPath = new Uint8Array(grid.cellCount);
    const path: number[] = [];
    const extend = (cell: number): void => {
        isOnPath[cell] = 1;
        path.push(cell);
        if (path.length === grid.cellCount) paths.push(path.slice());
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge < 0) continue;
            const next = grid.edgeCellA[edge] === cell ? grid.edgeCellB[edge] : grid.edgeCellA[edge];
            if (isOnPath[next] === 0) extend(next);
        }
        isOnPath[cell] = 0;
        path.pop();
    };
    for (let cell = 0; cell < grid.cellCount; cell++) extend(cell);
    return paths;
}

function toStates(grid: MazeGrid, path: readonly number[]): Uint8Array {
    const states = new Uint8Array(grid.edgeCount);
    for (let i = 0; i + 1 < path.length; i++) states[grid.edgeBetween(path[i], path[i + 1])] = PASSAGE;
    return states;
}

/** The puzzle a path makes, as a string: its start, its end and its clues. */
function describePuzzle(grid: MazeGrid, path: readonly number[]): string {
    const clues = readClues(grid, toStates(grid, path)).map((clue) => clue.join('.')).join('/');
    return `${path[0]} ${path[path.length - 1]} ${clues}`;
}

function solverFor(grid: MazeGrid, path: readonly number[]) {
    return createMazeSolver({ grid, clues: readClues(grid, toStates(grid, path)), start: path[0], end: path[path.length - 1] });
}
