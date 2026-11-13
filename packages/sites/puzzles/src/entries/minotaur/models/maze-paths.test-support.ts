// What the maze solver's tests share: every path through a small grid, and
// the puzzle and the solver that each path makes.
import { PASSAGE } from './edge-states';
import type { MazeGrid } from './maze-grid';
import { createMazeSolver } from './maze-solver';
import { readClues } from './read-clues';

/** Every path through every cell of `grid`, from every start, as its cells in order. */
export function listEveryPath(grid: MazeGrid): number[][] {
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

/**
 * Lists every path through a grid, and returns how many there are, how many
 * are alone in their puzzle (so the puzzle has one solution), and on how
 * many the solver agrees about whether the puzzle has one solution.
 */
export function compareWithBruteForce(grid: MazeGrid): [paths: number, unique: number, agreed: number] {
    const all = listEveryPath(grid);
    const groups = new Map<string, number>();
    for (const path of all) groups.set(describePuzzle(grid, path), (groups.get(describePuzzle(grid, path)) ?? 0) + 1);
    let agreed = 0;
    let alone = 0;
    for (const path of all) {
        const isAlone = groups.get(describePuzzle(grid, path)) === 1;
        if (isAlone) alone++;
        const solutions = createSolverFor(grid, path).countSolutions(2);
        if ((solutions === 1) === isAlone) agreed++;
    }
    return [all.length, alone, agreed];
}

/** Returns the solver for the puzzle that a path makes. */
export function createSolverFor(grid: MazeGrid, path: readonly number[]) {
    return createMazeSolver({ grid, clues: readClues(grid, toStates(grid, path)), start: path[0], end: path[path.length - 1] });
}

/** The puzzle a path makes, as a string: its start, its end and its clues. */
function describePuzzle(grid: MazeGrid, path: readonly number[]): string {
    const clues = readClues(grid, toStates(grid, path)).map((clue) => clue.join('.')).join('/');
    return `${path[0]} ${path[path.length - 1]} ${clues}`;
}

function toStates(grid: MazeGrid, path: readonly number[]): Uint8Array {
    const states = new Uint8Array(grid.edgeCount);
    for (let i = 0; i + 1 < path.length; i++) states[grid.edgeBetween(path[i], path[i + 1])] = PASSAGE;
    return states;
}
