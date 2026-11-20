import type { Random } from '@mvtjs/site-kit/random';
import type { DrawnRiver } from './draw-river';
import { findEndSide, findGivenPiece, NO_GIVEN } from './given-pieces';
import type { RiverSolver, RiverTechnique } from './river-solver';
import { UNKNOWN } from './river-states';
import type { ValleyGrid } from './valley-grid';

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
 * Returns givens for a puzzle, so that the techniques up to `most` finish
 * it without guessing, or following where a guess leads. Each given is what
 * a cell printed on the valley shows, or `NO_GIVEN` for a cell not printed.
 * While the techniques leave cells open, or cells with sides open, it
 * prints one of them, picked at random, as the solution has it. That is dry
 * land, or the cell's piece of river. Then it removes each given, in a
 * random order, and puts it back only if the techniques can't finish
 * without it. It repeats that pass until a whole pass keeps every given,
 * since removing one given can make another unneeded.
 */
export function findGivens(options: FindGivensOptions): Uint8Array {
    const { grid, river, solver, most, random } = options;
    const { cellCount, cellEdges } = grid;
    const givens = new Uint8Array(cellCount).fill(NO_GIVEN);
    const openCells = new Int32Array(cellCount);
    let solved = solver.solve(givens, most);
    while (!solved.isFinished) {
        let openCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            let isOpen = solved.cells[cell] === UNKNOWN;
            for (let side = 0; side < 4 && !isOpen; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0 && solved.edges[edge] === UNKNOWN) isOpen = true;
            }
            if (isOpen) openCells[openCount++] = cell;
        }
        const cell = openCells[random.nextIndex(openCount)];
        givens[cell] = findGivenPiece(grid, river.cells, river.edges, cell, findEndSide(cell, river.spring, river.sea));
        solved = solver.solve(givens, most);
    }

    // Remove each given the techniques can do without
    const givenCells = new Int32Array(cellCount);
    let givenCount = 0;
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] !== NO_GIVEN) givenCells[givenCount++] = cell;
    }
    for (let i = givenCount - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        const cell = givenCells[i];
        givenCells[i] = givenCells[j];
        givenCells[j] = cell;
    }
    // Each pass goes in the same order, and only the shuffle above is random, so a later pass changes a puzzle only if it removes a given
    let isRemoved = true;
    while (isRemoved) {
        isRemoved = false;
        for (let i = 0; i < givenCount; i++) {
            const cell = givenCells[i];
            const given = givens[cell];
            if (given === NO_GIVEN) continue;
            givens[cell] = NO_GIVEN;
            if (solver.solve(givens, most).isFinished) isRemoved = true;
            else givens[cell] = given;
        }
    }
    return givens;
}
