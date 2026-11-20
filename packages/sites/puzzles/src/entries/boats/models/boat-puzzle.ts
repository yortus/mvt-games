import { createRandom } from '@mvtjs/site-kit/random';
import { BOAT } from './cell-states';
import { findGivens } from './find-givens';
import { NO_GIVEN } from './given-pieces';
import { createHarbourGrid, type HarbourGrid } from './harbour-grid';
import type { LevelSettings } from './levels';
import { createBoatSolver, type BoatTechnique } from './boat-solver';
import { placeBoats } from './place-boats';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A puzzle to solve: its harbour, its fleet, its numbers, the cells printed on it, and its one solution. */
export interface BoatPuzzle {
    /** The harbour, and which cells are next to which. */
    readonly grid: HarbourGrid;
    /** The length of every boat to place, longest first. */
    readonly fleet: readonly number[];
    /** How many boat cells each row holds, from the top. */
    readonly rowCounts: Readonly<Uint8Array>;
    /** How many boat cells each column holds, from the left. */
    readonly colCounts: Readonly<Uint8Array>;
    /** What each cell printed on the harbour at the start shows, as a number from `given-pieces`, and `NO_GIVEN` for the rest. */
    readonly givens: Readonly<Uint8Array>;
    /** Each cell of the solution, as `BOAT` or `WATER`. */
    readonly solution: Readonly<Uint8Array>;
    /** The hardest technique it needs. */
    readonly hardest: BoatTechnique;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a puzzle is made from. */
export interface BoatPuzzleOptions {
    /** Any whole number. The same seed always makes the same puzzle. */
    readonly seed: number;
    /** The puzzle's size and fleet, and what it must take to solve. */
    readonly settings: LevelSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from `seed` that the level's techniques solve, with
 * nothing supposed, so it has one solution and never needs guessing. It
 * works backwards from the answer: it places the boats, reads the numbers
 * off the rows and columns, then prints a few givens on the harbour, until
 * the techniques finish it, keeping only the givens they need. It finds
 * givens a few times over, at random, and keeps the fewest. A level that
 * requires its hardest technique gets a puzzle that needs it, or the maker
 * starts again with new boats.
 */
export function createBoatPuzzle(options: BoatPuzzleOptions): BoatPuzzle {
    const { size, fleet, hardest, isHardestNeeded } = options.settings;
    const grid = createHarbourGrid({ size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const solution = placeBoats({ grid, fleet, random });
        const rowCounts = new Uint8Array(size);
        const colCounts = new Uint8Array(size);
        for (let cell = 0; cell < grid.cellCount; cell++) {
            if (solution[cell] !== BOAT) continue;
            rowCounts[Math.floor(cell / size)]++;
            colCounts[cell % size]++;
        }
        const solver = createBoatSolver({ grid, fleet, rowCounts, colCounts });
        let best: Uint8Array | undefined;
        let bestCount = Infinity;
        for (let tries = 0; tries < GIVENS_TRIES; tries++) {
            const givens = findGivens({ grid, solution, solver, most: hardest, random });
            const count = countGivens(givens);
            if (count >= bestCount || (isHardestNeeded && solver.solve(givens, hardest).hardest !== hardest)) continue;
            best = givens;
            bestCount = count;
        }
        if (best !== undefined) return { grid, fleet, rowCounts, colCounts, givens: best, solution, hardest: solver.solve(best, hardest).hardest };
    }
    throw new Error(`No ${size} by ${size} puzzle that needs ${hardest} turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many fleets to place before giving up. No level comes near it. */
const MOST_ATTEMPTS = 1000;

/** How many times to find givens for one fleet, keeping the fewest. More find fewer givens, at a cost in time. */
const GIVENS_TRIES = 3;

/** Returns how many cells of `givens` are printed on the harbour. */
function countGivens(givens: Readonly<Uint8Array>): number {
    let count = 0;
    for (let cell = 0; cell < givens.length; cell++) {
        if (givens[cell] !== NO_GIVEN) count++;
    }
    return count;
}
