import type { Random } from '@mvtjs/site-kit/random';
import { EMPTY, STAR, UNKNOWN } from './cell-states';
import type { StarGrid } from './star-grid';
import type { StarSolver, StarTechnique } from './star-solver';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FindGivensOptions {
    readonly grid: StarGrid;
    /** The stars the puzzle is made round, as `STAR` or `EMPTY` for each cell. */
    readonly solution: Readonly<Uint8Array>;
    /** A solver for the puzzle's regions. */
    readonly solver: StarSolver;
    /** The hardest technique the player is expected to use. */
    readonly most: StarTechnique;
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns givens for a puzzle, `STAR` or `EMPTY` for each cell printed on
 * the grid and `UNKNOWN` for the rest, so that the techniques up to `most`
 * finish it, with nothing supposed. While the techniques leave cells open,
 * it gives one of them, picked at random, its value in the solution. Then
 * it takes each given away, in a random order, and puts it back only if the
 * techniques can't finish without it. So every given left is needed, though
 * another set might be smaller.
 */
export function findGivens(options: FindGivensOptions): Uint8Array {
    const { grid, solution, solver, most, random } = options;
    const { cellCount } = grid;
    const givens = new Uint8Array(cellCount).fill(UNKNOWN);
    const open = new Int32Array(cellCount);
    let solved = solver.solve(givens, most);
    while (!solved.isFinished) {
        let openCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            if (solved.cells[cell] === UNKNOWN) open[openCount++] = cell;
        }
        const cell = open[random.nextIndex(openCount)];
        givens[cell] = solution[cell] === STAR ? STAR : EMPTY;
        solved = solver.solve(givens, most);
    }

    // Take away each given the techniques can do without
    let givenCount = 0;
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] !== UNKNOWN) open[givenCount++] = cell;
    }
    for (let i = givenCount - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        const cell = open[i];
        open[i] = open[j];
        open[j] = cell;
    }
    for (let i = 0; i < givenCount; i++) {
        const cell = open[i];
        const given = givens[cell];
        givens[cell] = UNKNOWN;
        if (!solver.solve(givens, most).isFinished) givens[cell] = given;
    }
    return givens;
}
