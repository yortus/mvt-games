import type { Random } from '@mvtjs/site-kit/random';
import type { DrawnRiver } from './draw-river';
import { findGivenPiece, NO_GIVEN } from './given-pieces';
import type { RiverSolver, RiverTechnique } from './river-solver';
import { UNKNOWN } from './river-states';
import { LEFT, DOWN, type ValleyGrid } from './valley-grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `findGivens` works from. */
export interface FindGivensOptions {
    /** The puzzle's valley. */
    readonly grid: ValleyGrid;
    /** The river the puzzle is made round. */
    readonly river: DrawnRiver;
    /** A solver for the puzzle's ends and numbers. */
    readonly solver: RiverSolver;
    /** The hardest technique the player is expected to use. */
    readonly most: RiverTechnique;
    /** Where the random choices come from, so the same seed finds the same givens. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns givens for a puzzle, what each cell printed on the valley shows
 * and `NO_GIVEN` for the rest, so that the techniques up to `most` finish
 * it, with nothing supposed. It works as Stars' maker does. While the
 * techniques leave cells open, or cells with sides open, it prints one of
 * them, picked at random, as the solution has it: dry land, or its piece of
 * river. Then it removes each given, in a random order, and puts it back
 * only if the techniques can't finish without it. It repeats that pass
 * until a whole pass keeps every given, since removing one given can make
 * another unneeded.
 */
export function findGivens(options: FindGivensOptions): Uint8Array {
    const { grid, river, solver, most, random } = options;
    const { cellCount, cellEdges } = grid;
    const givens = new Uint8Array(cellCount).fill(NO_GIVEN);
    const open = new Int32Array(cellCount);
    const endSide = (cell: number): number => (cell === river.spring ? LEFT : cell === river.sea ? DOWN : -1);
    let solved = solver.solve(givens, most);
    while (!solved.isFinished) {
        let openCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            let isOpen = solved.cells[cell] === UNKNOWN;
            for (let side = 0; side < 4 && !isOpen; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0 && solved.edges[edge] === UNKNOWN) isOpen = true;
            }
            if (isOpen) open[openCount++] = cell;
        }
        const cell = open[random.nextIndex(openCount)];
        givens[cell] = findGivenPiece(grid, river.cells, river.edges, cell, endSide(cell));
        solved = solver.solve(givens, most);
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
    // Each pass goes in the same order, and only the shuffle above is random, so a later pass changes a puzzle only if it removes a given
    let isRemoved = true;
    while (isRemoved) {
        isRemoved = false;
        for (let i = 0; i < givenCount; i++) {
            const cell = open[i];
            const given = givens[cell];
            if (given === NO_GIVEN) continue;
            givens[cell] = NO_GIVEN;
            if (solver.solve(givens, most).isFinished) isRemoved = true;
            else givens[cell] = given;
        }
    }
    return givens;
}
