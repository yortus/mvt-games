import { drawRandomPath } from './draw-random-path';
import { PASSAGE, WALL } from './edge-states';
import type { LevelSettings } from './levels';
import { createMazeGrid, type MazeGrid } from './maze-grid';
import { createMazeSolver } from './maze-solver';
import { createRandom } from './random';
import { readClues } from './read-clues';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A maze to solve: its grid, where the path starts and ends, the clues on its lines, and its one solution. */
export interface MazePuzzle {
    readonly grid: MazeGrid;
    readonly start: number;
    readonly end: number;
    /** Each line's clue: the lengths of its stretches of wall, in order along it. */
    readonly clues: readonly (readonly number[])[];
    /** Each edge of the solution, as `PASSAGE` or `WALL`. */
    readonly solution: Readonly<Uint8Array>;
    /** What it takes to solve. */
    readonly reasoning: LevelSettings['reasoning'];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MazePuzzleOptions {
    /** Any whole number. The same seed always makes the same puzzle. */
    readonly seed: number;
    /** The puzzle's size, and what it must take to solve. */
    readonly settings: LevelSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from `seed`. It draws a random path through every cell,
 * reads the clues off the walls it leaves, and keeps the puzzle only if it
 * can be solved without guessing, which means it has one solution, and
 * takes the reasoning asked for. Otherwise it draws another. Most paths
 * make a puzzle with one solution, so it rarely draws more than a few.
 */
export function createMazePuzzle(options: MazePuzzleOptions): MazePuzzle {
    const { size, reasoning } = options.settings;
    const grid = createMazeGrid({ rows: size, cols: size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const path = drawRandomPath({ grid, random });
        const solution = new Uint8Array(grid.edgeCount).fill(WALL);
        for (let i = 0; i + 1 < path.length; i++) solution[grid.edgeBetween(path[i], path[i + 1])] = PASSAGE;
        const clues = readClues(grid, solution);
        const start = path[0];
        const end = path[path.length - 1];
        if (createMazeSolver({ grid, clues, start, end }).grade() === reasoning) return { grid, start, end, clues, solution, reasoning };
    }
    throw new Error(`No ${size} by ${size} maze that takes ${reasoning} turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many paths to draw before giving up. No level comes near it: most paths make a good puzzle. */
const MOST_ATTEMPTS = 1000;
