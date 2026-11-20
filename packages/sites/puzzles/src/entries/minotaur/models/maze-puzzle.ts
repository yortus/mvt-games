import { drawRandomPath } from './draw-random-path';
import { PASSAGE, WALL } from './edge-states';
import type { LevelSettings } from './levels';
import { createMazeGrid, type MazeGrid } from './maze-grid';
import { createMazeSolver } from './maze-solver';
import { createRandom, type Random } from '@mvtjs/site-kit/random';
import { readClues } from './read-clues';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A maze to solve: its grid, where the path starts and ends, the clues on its lines, and its one solution. */
export interface MazePuzzle {
    readonly grid: MazeGrid;
    readonly start: number;
    readonly end: number;
    /**
     * Each line's clue, as the lengths of its stretches of wall in order along
     * it. A hidden clue is undefined, so the player works that line out from
     * the cells and loops around it.
     */
    readonly clues: readonly (readonly number[] | undefined)[];
    /** Each edge of the solution, as `PASSAGE` or `WALL`. */
    readonly solution: Readonly<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MazePuzzleOptions {
    /** Any whole number. The same seed always makes the same puzzle. */
    readonly seed: number;
    /** The puzzle's size, and how many clues it may hide. */
    readonly settings: LevelSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from `seed`. It draws a random path through every cell,
 * and reads the clues off the walls that the path leaves. It keeps the
 * puzzle only if the solver's rules finish it, so the puzzle has one
 * solution and never needs a guess. Otherwise it draws another path. The
 * rules finish about nine paths in ten up to 9 by 9, and three in four at
 * 11 by 11, so it rarely draws more than a few.
 *
 * Then it hides as many clues as the level allows. It visits the lines in a
 * random order, and hides each line's clue if the rules can still finish
 * the maze without it. Every clue it hides leaves the maze solvable without
 * a guess, but there is less to work from.
 */
export function createMazePuzzle(options: MazePuzzleOptions): MazePuzzle {
    const { size, mostHiddenClues } = options.settings;
    const grid = createMazeGrid({ rows: size, cols: size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const path = drawRandomPath({ grid, random });
        const solution = new Uint8Array(grid.edgeCount).fill(WALL);
        for (let i = 0; i + 1 < path.length; i++) solution[grid.edgeBetween(path[i], path[i + 1])] = PASSAGE;
        const clues = readClues(grid, solution);
        const start = path[0];
        const end = path[path.length - 1];
        if (!createMazeSolver({ grid, clues, start, end }).solve().isFinished) continue;
        const shown = mostHiddenClues > 0 ? hideClues({ grid, clues, start, end, mostHiddenClues, random }) : clues;
        return { grid, start, end, clues: shown, solution };
    }
    throw new Error(`No ${size} by ${size} maze that the rules finish turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many paths to draw before giving up. Every level stays far below it, since most paths make a good puzzle. */
const MOST_ATTEMPTS = 1000;

/** What `hideClues` works on. */
interface HideCluesOptions {
    readonly grid: MazeGrid;
    readonly clues: readonly (readonly number[])[];
    readonly start: number;
    readonly end: number;
    readonly mostHiddenClues: number;
    readonly random: Random;
}

/**
 * Returns `clues` with up to `mostHiddenClues` of them hidden, as undefined.
 * It visits the lines in a random order, and hides a line's clue only if
 * the rules still finish the maze from the clues left.
 */
function hideClues(options: HideCluesOptions): readonly (readonly number[] | undefined)[] {
    const { grid, clues, start, end, mostHiddenClues, random } = options;
    const shown: (readonly number[] | undefined)[] = clues.slice();
    const order = Array.from({ length: grid.lineCount }, (_, line) => line);
    for (let i = order.length - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    let hiddenCount = 0;
    for (let i = 0; i < order.length && hiddenCount < mostHiddenClues; i++) {
        const line = order[i];
        shown[line] = undefined;
        if (createMazeSolver({ grid, clues: shown, start, end }).solve().isFinished) hiddenCount++;
        else shown[line] = clues[line];
    }
    return shown;
}
