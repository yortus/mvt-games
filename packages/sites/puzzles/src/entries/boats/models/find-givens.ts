import type { Random } from '@mvtjs/site-kit/random';
import { UNKNOWN } from './cell-states';
import { findGivenPiece, NO_GIVEN } from './given-pieces';
import type { HarbourGrid } from './harbour-grid';
import type { BoatSolver, BoatTechnique } from './boat-solver';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `findGivens` works from. */
export interface FindGivensOptions {
    /** The puzzle's harbour. */
    readonly grid: HarbourGrid;
    /** The boats the puzzle is made round, as `BOAT` or `WATER` for each cell. */
    readonly solution: Readonly<Uint8Array>;
    /** A solver for the puzzle's fleet and numbers. */
    readonly solver: BoatSolver;
    /** The hardest technique the player is expected to use. */
    readonly hardest: BoatTechnique;
    /** Where the random choices come from, so the same seed finds the same givens. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns givens for a puzzle, so that the techniques up to `hardest` finish
 * it without guessing, or following where a guess leads. The givens hold
 * what each cell printed on the harbour shows, and `NO_GIVEN` for the rest.
 * While the techniques leave cells open, it prints one of them, picked at
 * random, as the solution has it. Then it removes each given, in a random
 * order, and puts it back only if the techniques can't finish without it.
 * It repeats that pass until a whole pass keeps every given, since removing
 * one given can make another unneeded. Every given left is then needed,
 * though another set might be smaller.
 */
export function findGivens(options: FindGivensOptions): Uint8Array {
    const { grid, solution, solver, hardest, random } = options;
    const { cellCount } = grid;
    const givens = new Uint8Array(cellCount).fill(NO_GIVEN);
    const open = new Int32Array(cellCount);
    let solved = solver.solve(givens, hardest);
    while (!solved.isFinished) {
        let openCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            if (solved.cells[cell] === UNKNOWN) open[openCount++] = cell;
        }
        const cell = open[random.nextIndex(openCount)];
        givens[cell] = findGivenPiece(grid, solution, cell);
        solved = solver.solve(givens, hardest);
    }

    // Remove each given the techniques can do without
    let givenCount = 0;
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] !== NO_GIVEN) open[givenCount++] = cell;
    }
    for (let i = givenCount - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        const cell = open[i];
        open[i] = open[j];
        open[j] = cell;
    }
    // Every pass goes in the same order, so the shuffle above draws the only random numbers here
    let isRemoved = true;
    while (isRemoved) {
        isRemoved = false;
        for (let i = 0; i < givenCount; i++) {
            const cell = open[i];
            const given = givens[cell];
            if (given === NO_GIVEN) continue;
            givens[cell] = NO_GIVEN;
            if (solver.solve(givens, hardest).isFinished) isRemoved = true;
            else givens[cell] = given;
        }
    }
    return givens;
}
