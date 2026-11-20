import { BOAT } from './cell-states';
import { DOWN, type HarbourGrid, LEFT, RIGHT, UP } from './harbour-grid';

// What a cell printed on the harbour at the start shows, kept as a small
// number for each cell. A cell of a boat shows its piece: a whole dinghy,
// one end of a longer boat (which says which way the boat goes on), or a
// middle (which says only that the boat goes on both ways, across or down).
// Puzzles in players' browsers are described by these numbers, so they must
// never change.

/** A cell not printed on the harbour. */
export const NO_GIVEN = 0;

/** Open water. */
export const GIVEN_WATER = 1;

/** A whole boat one cell long. */
export const GIVEN_DINGHY = 2;

/** The end of a boat that goes on upwards. The ends that go on right, down and left follow, in that order. */
export const GIVEN_END_UP = 3;
export const GIVEN_END_RIGHT = 4;
export const GIVEN_END_DOWN = 5;
export const GIVEN_END_LEFT = 6;

/** A middle cell of a boat, which goes on both ways, across or down. */
export const GIVEN_MIDDLE = 7;

/** Returns what `cell` shows when it is printed on the harbour, from `solution`: water, or its piece of a boat. */
export function findGivenPiece(grid: HarbourGrid, solution: Readonly<Uint8Array>, cell: number): number {
    if (solution[cell] !== BOAT) return GIVEN_WATER;
    let mask = 0;
    for (let side = 0; side < 4; side++) {
        const next = grid.sides[cell * 4 + side];
        if (next >= 0 && solution[next] === BOAT) mask |= 1 << side;
    }
    switch (mask) {
        case 0: return GIVEN_DINGHY;
        case 1 << UP: return GIVEN_END_UP;
        case 1 << RIGHT: return GIVEN_END_RIGHT;
        case 1 << DOWN: return GIVEN_END_DOWN;
        case 1 << LEFT: return GIVEN_END_LEFT;
        default: return GIVEN_MIDDLE;
    }
}

/** Whether `given` is a piece of a boat, rather than water or nothing. */
export function isGivenBoat(given: number): boolean {
    return given >= GIVEN_DINGHY;
}
