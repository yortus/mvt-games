import { createRandom } from '@mvtjs/site-kit/random';
import { drawRiver } from './draw-river';
import { findGivens } from './find-givens';
import { NO_GIVEN } from './given-pieces';
import type { LevelSettings } from './levels';
import { createRiverSolver, type RiverTechnique } from './river-solver';
import { RIVER } from './river-states';
import { createValleyGrid, type ValleyGrid } from './valley-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A puzzle to solve: its valley, the river's two ends, its numbers, the cells printed on it, and its one solution. */
export interface RiverPuzzle {
    /** The valley, and which cells are next to which. */
    readonly grid: ValleyGrid;
    /** The cell the river rises in, on the left edge, running off the valley to its left. */
    readonly spring: number;
    /** The cell the river reaches the sea from, on the bottom edge, running off the valley below it. */
    readonly sea: number;
    /** How many river cells each row holds, from the top. */
    readonly rowCounts: Readonly<Uint8Array>;
    /** How many river cells each column holds, from the left. */
    readonly colCounts: Readonly<Uint8Array>;
    /** What each cell printed on the valley at the start shows, as a number from `given-pieces`, and `NO_GIVEN` for the rest. */
    readonly givens: Readonly<Uint8Array>;
    /** Each cell of the solution, as `RIVER` or `DRY`. */
    readonly solutionCells: Readonly<Uint8Array>;
    /** Each edge of the solution, as `RIVER` or `DRY`. */
    readonly solutionEdges: Readonly<Uint8Array>;
    /** The hardest technique it needs. */
    readonly hardest: RiverTechnique;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a puzzle is made from. */
export interface RiverPuzzleOptions {
    /** Any whole number. The same seed always makes the same puzzle. */
    readonly seed: number;
    /** The puzzle's size, how much of it the river fills, and what it must take to solve. */
    readonly settings: LevelSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from `seed` that the level's techniques solve, with
 * nothing supposed, so it has one solution and never needs guessing. It
 * works backwards from the answer. It draws a river, reads the numbers off
 * the rows and columns, then prints a few givens on the valley, until the
 * techniques finish it, keeping only the givens they need. It finds givens
 * a few times over, at random, and keeps the fewest. A level that requires
 * its hardest technique gets a puzzle that needs it, or the maker starts
 * again with a new river.
 */
export function createRiverPuzzle(options: RiverPuzzleOptions): RiverPuzzle {
    const { size, leastFill, mostFill, hardest, isHardestNeeded } = options.settings;
    const grid = createValleyGrid({ size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const river = drawRiver({ grid, leastFill, mostFill, random });
        const rowCounts = new Uint8Array(size);
        const colCounts = new Uint8Array(size);
        for (let cell = 0; cell < grid.cellCount; cell++) {
            if (river.cells[cell] !== RIVER) continue;
            rowCounts[Math.floor(cell / size)]++;
            colCounts[cell % size]++;
        }
        const solver = createRiverSolver({ grid, spring: river.spring, sea: river.sea, rowCounts, colCounts });
        let best: Uint8Array | undefined;
        let bestCount = Infinity;
        for (let tries = 0; tries < GIVENS_TRIES; tries++) {
            const givens = findGivens({ grid, river, solver, most: hardest, random });
            const count = countGivens(givens);
            if (count >= bestCount || (isHardestNeeded && solver.solve(givens, hardest).hardest !== hardest)) continue;
            best = givens;
            bestCount = count;
        }
        if (best === undefined) continue;
        return {
            grid,
            spring: river.spring,
            sea: river.sea,
            rowCounts,
            colCounts,
            givens: best,
            solutionCells: river.cells,
            solutionEdges: river.edges,
            hardest: solver.solve(best, hardest).hardest,
        };
    }
    throw new Error(`No ${size} by ${size} puzzle that needs ${hardest} turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many rivers to draw before giving up. No level comes near it. */
const MOST_ATTEMPTS = 1000;

/** How many times to find givens for one river, keeping the fewest. More find fewer givens, at a cost in time. */
const GIVENS_TRIES = 3;

/** Returns how many cells of `givens` are printed on the valley. */
function countGivens(givens: Readonly<Uint8Array>): number {
    let count = 0;
    for (let cell = 0; cell < givens.length; cell++) {
        if (givens[cell] !== NO_GIVEN) count++;
    }
    return count;
}
