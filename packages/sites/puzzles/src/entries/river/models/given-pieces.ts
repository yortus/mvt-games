import { RIVER } from './river-states';
import type { ValleyGrid } from './valley-grid';

// What a cell printed on the valley at the start shows, kept as a small
// number for each cell: dry land, or a piece of river. A piece is the sides
// the river runs through, one bit for each side, up, right, down and left,
// from the lowest bit. A piece has two sides, a straight reach or a bend.
// Puzzles in players' browsers are described by these numbers, so they must
// never change.

/** A cell not printed on the valley. */
export const NO_GIVEN = 0;

/** Dry land, which the river keeps away from. It is above every piece, which uses only the lowest four bits. */
export const GIVEN_DRY = 16;

/** Whether `given` is a piece of river, rather than dry land or nothing. */
export function isGivenRiver(given: number): boolean {
    return given > NO_GIVEN && given < GIVEN_DRY;
}

/**
 * Returns what `cell` shows when it is printed on the valley: dry land, or
 * its piece of the river, from the solution's `cells` and `edges`. An end of
 * the river runs off the valley across `endSide`, which its piece includes.
 */
export function findGivenPiece(grid: ValleyGrid, cells: Readonly<Uint8Array>, edges: Readonly<Uint8Array>, cell: number, endSide: number): number {
    if (cells[cell] !== RIVER) return GIVEN_DRY;
    let mask = endSide >= 0 ? 1 << endSide : 0;
    for (let side = 0; side < 4; side++) {
        const edge = grid.cellEdges[cell * 4 + side];
        if (edge >= 0 && edges[edge] === RIVER) mask |= 1 << side;
    }
    return mask;
}
