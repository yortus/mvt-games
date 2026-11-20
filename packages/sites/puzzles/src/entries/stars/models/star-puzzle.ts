import { createRandom } from '@mvtjs/site-kit/random';
import { UNKNOWN } from './cell-states';
import { findGivens } from './find-givens';
import { growRegions } from './grow-regions';
import { layOutStars } from './lay-out-stars';
import type { LevelSettings } from './levels';
import { createStarGrid, type StarGrid } from './star-grid';
import { createStarSolver, type StarTechnique } from './star-solver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A puzzle to solve: its grid, its regions, the cells printed on it, and its one solution. */
export interface StarPuzzle {
    readonly grid: StarGrid;
    /** Each cell's region, numbered from 0. */
    readonly regions: Readonly<Uint8Array>;
    /** The cells printed on the grid at the start: `STAR` or `EMPTY`, and `UNKNOWN` for the rest. */
    readonly givens: Readonly<Uint8Array>;
    /** Each cell of the solution, as `STAR` or `EMPTY`. */
    readonly solution: Readonly<Uint8Array>;
    /** The hardest technique it takes. */
    readonly hardest: StarTechnique;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StarPuzzleOptions {
    /** Any whole number. The same seed always makes the same puzzle. */
    readonly seed: number;
    /** The puzzle's size, and what it must take to solve. */
    readonly settings: LevelSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from `seed` that the level's techniques solve, with
 * nothing supposed, so it has one solution and never takes guessing. It
 * works backwards from the answer: it lays out the stars, grows regions
 * round them, then prints a few givens on the grid, until the techniques
 * finish it, keeping only the givens they need. It finds givens a few
 * times over, at random, and keeps the fewest. A level that asks for its
 * hardest technique gets a puzzle that needs it, or the maker starts again.
 */
export function createStarPuzzle(options: StarPuzzleOptions): StarPuzzle {
    const { size, hardest, isHardestNeeded } = options.settings;
    const grid = createStarGrid({ size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const solution = layOutStars({ grid, random });
        const regions = growRegions({ grid, solution, random });
        if (regions === undefined) continue;
        const solver = createStarSolver({ grid, regions });
        let best: Uint8Array | undefined;
        let bestCount = Infinity;
        for (let tries = 0; tries < GIVENS_TRIES; tries++) {
            const givens = findGivens({ grid, solution, solver, most: hardest, random });
            const count = countGivens(givens);
            if (count >= bestCount || (isHardestNeeded && solver.solve(givens, hardest).hardest !== hardest)) continue;
            best = givens;
            bestCount = count;
        }
        if (best !== undefined) return { grid, regions, givens: best, solution, hardest: solver.solve(best, hardest).hardest };
    }
    throw new Error(`No ${size} by ${size} puzzle that takes ${hardest} turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many layouts to try before giving up. No level comes near it. */
const MOST_ATTEMPTS = 1000;

/** How many times to find givens for one layout, keeping the fewest. More find fewer givens, at a cost in time. */
const GIVENS_TRIES = 3;

function countGivens(givens: Readonly<Uint8Array>): number {
    let count = 0;
    for (let cell = 0; cell < givens.length; cell++) {
        if (givens[cell] !== UNKNOWN) count++;
    }
    return count;
}
