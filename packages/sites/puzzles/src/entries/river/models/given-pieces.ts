import { RIVER } from './river-states';
import { DOWN, LEFT, type ValleyGrid } from './valley-grid';

// A given is a cell printed on the valley at the start. Each cell's given is
// kept as a small number, for dry land or a piece of river. A piece holds one
// bit for each side that the river runs through, starting from the lowest
// bit for up, then right, down and left. Each piece has exactly two sides
// set, so it is a straight stretch of river or a bend. Puzzles in players'
// browsers are described by these numbers, so they must never change.

/** A cell not printed on the valley. */
export const NO_GIVEN = 0;

/** Dry land, which the river keeps away from. It is above every piece, which uses only the lowest four bits. */
export const GIVEN_DRY = 16;

/** Whether `given` is a piece of river, rather than dry land or nothing. */
export function isGivenRiver(given: number): boolean {
    return given > NO_GIVEN && given < GIVEN_DRY;
}

/**
 * Returns what `cell` shows when it is printed on the valley, which is dry
 * land or its piece of the river. It reads the solution's `cells` and
 * `edges`. An end of the river runs off the valley across `endSide`, which
 * its piece includes, and every other cell passes -1.
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

/** Returns the side that `cell` runs off the valley by, if it is the spring or the sea, or -1 if it is neither. */
export function findEndSide(cell: number, spring: number, sea: number): number {
    if (cell === spring) return LEFT;
    return cell === sea ? DOWN : -1;
}
