import type { Random } from '@mvtjs/site-kit/random';
import { BOAT, WATER } from './cell-states';
import type { HarbourGrid } from './harbour-grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `placeBoats` works from. */
export interface PlaceBoatsOptions {
    /** The harbour to place them in. */
    readonly grid: HarbourGrid;
    /** The length of every boat, longest first. */
    readonly fleet: readonly number[];
    /** Where the random choices come from, so the same seed places the same boats. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a harbour with every boat of the fleet placed at random, as
 * `BOAT` or `WATER` for each cell, with no two boats touching, not even
 * diagonally. It places the longest boats first, while there is the most
 * room, each at a place picked at random from every place it fits. If a
 * boat has nowhere left to go, it starts again.
 */
export function placeBoats(options: PlaceBoatsOptions): Uint8Array {
    const { grid, fleet, random } = options;
    const { size, cellCount } = grid;
    const cells = new Uint8Array(cellCount);
    const starts = new Int32Array(cellCount * 2);
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        cells.fill(WATER);
        let isPlaced = true;
        for (let boat = 0; boat < fleet.length && isPlaced; boat++) {
            const length = fleet[boat];
            // List every place it fits. Each is stored as its first cell doubled, plus one for a boat going down
            let count = 0;
            const directions = length === 1 ? 1 : 2;
            for (let start = 0; start < cellCount; start++) {
                for (let direction = 0; direction < directions; direction++) {
                    if (fits(start, length, direction === 1)) starts[count++] = start * 2 + direction;
                }
            }
            if (count === 0) {
                isPlaced = false;
                continue;
            }
            const place = starts[random.nextIndex(count)];
            const step = place % 2 === 1 ? size : 1;
            for (let i = 0; i < length; i++) cells[(place >> 1) + i * step] = BOAT;
        }
        if (isPlaced) return cells;
    }
    throw new Error(`Couldn't place a fleet of ${fleet.join(', ')} in ${MOST_ATTEMPTS} attempts`);

    /** Whether a boat `length` long fits from `start`, down if `isDown`, with no boat in or round it. */
    function fits(start: number, length: number, isDown: boolean): boolean {
        const row = Math.floor(start / size);
        const col = start % size;
        if ((isDown ? row : col) + length > size) return false;
        const lastRow = isDown ? row + length : row + 1;
        const lastCol = isDown ? col + 1 : col + length;
        for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, lastRow); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, lastCol); c++) {
                if (cells[r * size + c] === BOAT) return false;
            }
        }
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many times to try placing the whole fleet before giving up. Every level's fleet needs far fewer. */
const MOST_ATTEMPTS = 1000;
