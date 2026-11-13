import { createRandom, type Random } from '@mvtjs/site-kit/random';
import { STAR } from './cell-states';
import { growRegions, isRegionWhole } from './grow-regions';
import { layOutStars } from './lay-out-stars';
import type { LevelSettings } from './levels';
import { createStarGrid, type StarGrid } from './star-grid';
import { createStarSolver } from './star-solver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A puzzle to solve: its grid, its regions, and its one solution. */
export interface StarPuzzle {
    readonly grid: StarGrid;
    /** Each cell's region, numbered from 0. */
    readonly regions: Readonly<Uint8Array>;
    /** Each cell of the solution, as `STAR` or `EMPTY`. */
    readonly solution: Readonly<Uint8Array>;
    /** What it takes to solve. */
    readonly reasoning: LevelSettings['reasoning'];
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
 * Creates a puzzle from `seed`. It works backwards from the answer: it lays
 * out the stars first, then grows regions around them, two stars in each,
 * so the puzzle has at least one solution, its own. While it has others, it
 * takes one of them, finds a cell that is a star there but not in its own,
 * and moves that cell into a neighbouring region. The other solution now
 * has a region with a star too many, so it is gone, and its own still
 * holds. Once one solution is left, the puzzle is kept if it takes the
 * reasoning asked for. Otherwise it starts again.
 */
export function createStarPuzzle(options: StarPuzzleOptions): StarPuzzle {
    const { size, reasoning } = options.settings;
    const grid = createStarGrid({ size });
    const random = createRandom({ seed: options.seed });
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const solution = layOutStars({ grid, random });
        const regions = growRegions({ grid, solution, random });
        if (regions === undefined || !reshapeRegions(grid, regions, solution, random)) continue;
        if (createStarSolver({ grid, regions }).grade() === reasoning) return { grid, regions, solution, reasoning };
    }
    throw new Error(`No ${size} by ${size} puzzle that takes ${reasoning} turned up in ${MOST_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many layouts to try before giving up. No level comes near it. */
const MOST_ATTEMPTS = 1000;

/** How many solutions a count stops at, while reshaping. */
const MOST_COUNTED = 10;

/** How many changes to try, for each row of the grid, before starting again. */
const TRIES_PER_ROW = 30;

/** How often a change that leaves more solutions is kept anyway, so the search doesn't get stuck. */
const WORSE_CHANGE_ODDS = 0.2;

/** Moves cells between regions until `solution` is the only solution. Returns whether it got there. */
function reshapeRegions(grid: StarGrid, regions: Uint8Array, solution: Readonly<Uint8Array>, random: Random): boolean {
    const { size, cellCount, sides } = grid;
    let found: Uint8Array[] = [];
    let count = createStarSolver({ grid, regions }).countSolutions(MOST_COUNTED, found);
    const moves: number[] = [];
    for (let tries = 0; count > 1 && tries < TRIES_PER_ROW * size; tries++) {
        // Another solution: one with a star where ours has none
        const other = found.find((cells) => !isSameStars(cells, solution));
        if (other === undefined) return false;
        // Its stars that ours hasn't, each beside a region it could move into
        moves.length = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            if (other[cell] !== STAR || solution[cell] === STAR) continue;
            for (let side = 0; side < 4; side++) {
                const next = sides[cell * 4 + side];
                if (next >= 0 && regions[next] !== regions[cell]) moves.push(cell, regions[next]);
            }
        }
        if (moves.length === 0) return false;
        const move = random.nextIndex(moves.length / 2) * 2;
        const cell = moves[move];
        const from = regions[cell];
        if (!isRegionWhole(grid, regions, from, cell)) continue;
        regions[cell] = moves[move + 1];
        const nextFound: Uint8Array[] = [];
        const nextCount = createStarSolver({ grid, regions }).countSolutions(MOST_COUNTED, nextFound);
        if (nextCount <= count || random.next() < WORSE_CHANGE_ODDS) {
            count = nextCount;
            found = nextFound;
        }
        else regions[cell] = from;
    }
    return count === 1;
}

/** Whether `cells` has its stars where `solution` has. */
function isSameStars(cells: Readonly<Uint8Array>, solution: Readonly<Uint8Array>): boolean {
    for (let cell = 0; cell < cells.length; cell++) {
        if ((cells[cell] === STAR) !== (solution[cell] === STAR)) return false;
    }
    return true;
}
