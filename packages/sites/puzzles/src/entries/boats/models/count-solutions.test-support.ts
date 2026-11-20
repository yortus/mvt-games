import { BOAT, WATER } from './cell-states';
import { findGivenPiece, GIVEN_WATER, NO_GIVEN } from './given-pieces';
import type { BoatPuzzle } from './boat-puzzle';

/**
 * Counts the solutions of `puzzle`'s fleet, numbers and givens, up to
 * `most`, by a plain search that shares nothing with the solver: it places
 * each boat in turn, longest first, at every place it fits, and checks the
 * numbers and the givens once every boat is placed. Boats of the same length
 * are placed in order along the harbour, so each layout is counted once.
 */
export function countSolutions(puzzle: BoatPuzzle, most: number): number {
    const { grid, fleet, rowCounts, colCounts, givens } = puzzle;
    const { size, cellCount } = grid;
    const cells = new Uint8Array(cellCount).fill(WATER);
    const rowBoats = new Int32Array(size);
    const colBoats = new Int32Array(size);
    let count = 0;
    place(0, 0);
    return count;

    function place(boat: number, from: number): void {
        if (count >= most) return;
        if (boat === fleet.length) {
            for (let i = 0; i < size; i++) {
                if (rowBoats[i] !== rowCounts[i] || colBoats[i] !== colCounts[i]) return;
            }
            for (let cell = 0; cell < cellCount; cell++) {
                if (givens[cell] !== NO_GIVEN && findGivenPiece(grid, cells, cell) !== givens[cell]) return;
            }
            count++;
            return;
        }
        const length = fleet[boat];
        // A boat as long as the one before goes after it, so the same layout isn't counted twice
        const first = boat > 0 && fleet[boat - 1] === length ? from : 0;
        for (let key = first; key < cellCount * 2; key++) {
            const start = key >> 1;
            const isDown = key % 2 === 1;
            if (isDown && length === 1) continue;
            if (!fits(start, length, isDown)) continue;
            const step = isDown ? size : 1;
            for (let i = 0; i < length; i++) mark(start + i * step, 1);
            place(boat + 1, key + 1);
            for (let i = 0; i < length; i++) mark(start + i * step, -1);
        }
    }

    function fits(start: number, length: number, isDown: boolean): boolean {
        const row = Math.floor(start / size);
        const col = start % size;
        if ((isDown ? row : col) + length > size) return false;
        for (let i = 0; i < length; i++) {
            const r = isDown ? row + i : row;
            const c = isDown ? col : col + i;
            if (givens[r * size + c] === GIVEN_WATER || rowBoats[r] + 1 > rowCounts[r] || colBoats[c] + 1 > colCounts[c]) return false;
        }
        // Its own line holds every cell of it, so the line needs room for them all
        if ((isDown ? colBoats[col] : rowBoats[row]) + length > (isDown ? colCounts[col] : rowCounts[row])) return false;
        const lastRow = isDown ? row + length : row + 1;
        const lastCol = isDown ? col + 1 : col + length;
        for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, lastRow); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, lastCol); c++) {
                if (cells[r * size + c] === BOAT) return false;
            }
        }
        return true;
    }

    function mark(cell: number, change: number): void {
        cells[cell] = change > 0 ? BOAT : WATER;
        rowBoats[Math.floor(cell / size)] += change;
        colBoats[cell % size] += change;
    }
}
