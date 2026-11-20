import type { Random } from '@mvtjs/site-kit/random';
import { DRY, RIVER } from './river-states';
import type { ValleyGrid } from './valley-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A river drawn across a valley: where it rises and where it reaches the sea, and the cells and edges it runs through. */
export interface DrawnRiver {
    /** The cell it rises in, on the left edge, running off the valley to its left. */
    readonly spring: number;
    /** The cell it reaches the sea from, on the bottom edge, running off the valley below it. */
    readonly sea: number;
    /** Each cell, as `RIVER` or `DRY`. */
    readonly cells: Uint8Array;
    /** Each edge, as `RIVER` or `DRY`. */
    readonly edges: Uint8Array;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `drawRiver` works from. */
export interface DrawRiverOptions {
    /** The valley to draw it across. */
    readonly grid: ValleyGrid;
    /** The least and most of the valley's cells the river runs through, as shares from 0 to 1. */
    readonly leastFill: number;
    readonly mostFill: number;
    /** Where the random choices come from, so the same seed draws the same river. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a river across the valley, from a spring on its left edge to the
 * sea on its bottom edge, that never touches itself across a side it
 * doesn't cross. It is drawn in two steps:
 *
 * 1. A loop-erased random walk: walk from the spring to a random
 *    neighbour, again and again, until the walk reaches the sea. Whenever
 *    the walk comes back to a cell it passed through, rub out the loop it
 *    just made. What is left is a fair, winding path, though often a short
 *    one.
 * 2. Bends added: pick a step of the river from one cell to the next, and
 *    if the two cells beside them, on one side, are both free, take the
 *    river out through them and back. That adds two cells and a bend.
 *    Repeat until the river fills its share of the valley.
 *
 * If the walk alone fills more than the most, it starts again.
 */
export function drawRiver(options: DrawRiverOptions): DrawnRiver {
    const { grid, leastFill, mostFill, random } = options;
    const { size, cellCount } = grid;
    const at = new Int32Array(cellCount);
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
        const spring = random.nextIndex(size) * size;
        const sea = (size - 1) * size + random.nextIndex(size);
        if (Math.abs(Math.floor(spring / size) - (size - 1)) + (sea % size) < size / 2) continue;
        const path = walkWithoutLoops(spring, sea);
        const target = Math.round(cellCount * random.between(leastFill, mostFill));
        if (path.length > cellCount * mostFill) continue;
        addBends(path, target);
        if (path.length < cellCount * leastFill) continue;
        const cells = new Uint8Array(cellCount).fill(DRY);
        const edges = new Uint8Array(grid.edgeCount).fill(DRY);
        for (let i = 0; i < path.length; i++) {
            cells[path[i]] = RIVER;
            if (i > 0) edges[grid.edgeBetween(path[i - 1], path[i])] = RIVER;
        }
        return { spring, sea, cells, edges };
    }
    throw new Error(`Couldn't draw a river across ${size} by ${size} cells in ${MOST_ATTEMPTS} attempts`);

    /** Walks at random from `from` until it reaches `to`, rubbing out each loop as it closes. Returns the cells, in order. */
    function walkWithoutLoops(from: number, to: number): number[] {
        at.fill(-1);
        const path = [from];
        at[from] = 0;
        let cell = from;
        while (cell !== to) {
            const next = findNeighbour(cell, random.nextIndex(4));
            if (next < 0) continue;
            if (at[next] >= 0) {
                // Back where it has been: rub out the loop
                const keep = at[next] + 1;
                for (let i = keep; i < path.length; i++) at[path[i]] = -1;
                path.length = keep;
            }
            else {
                at[next] = path.length;
                path.push(next);
            }
            cell = next;
        }
        return path;
    }

    /** Adds bends to `path` until it is `target` cells long, or no more fit. */
    function addBends(path: number[], target: number): void {
        const isOnPath = new Uint8Array(cellCount);
        for (let i = 0; i < path.length; i++) isOnPath[path[i]] = 1;
        for (let tries = 0; tries < cellCount * TRIES_PER_CELL && path.length < target; tries++) {
            const i = random.nextIndex(path.length - 1);
            const a = path[i];
            const b = path[i + 1];
            const isAcross = Math.abs(b - a) === 1;
            // Out through the cells above or below a step across, or left or right of a step down
            const side = random.nextIndex(2) === 0 ? -1 : 1;
            const outA = findNeighbour(a, isAcross ? (side < 0 ? 0 : 2) : (side < 0 ? 3 : 1));
            const outB = findNeighbour(b, isAcross ? (side < 0 ? 0 : 2) : (side < 0 ? 3 : 1));
            if (outA < 0 || outB < 0 || isOnPath[outA] === 1 || isOnPath[outB] === 1) continue;
            path.splice(i + 1, 0, outA, outB);
            isOnPath[outA] = 1;
            isOnPath[outB] = 1;
        }
    }

    /** The cell across `side` of `cell`: up, right, down or left, or -1 past the edge. */
    function findNeighbour(cell: number, side: number): number {
        const row = Math.floor(cell / size);
        const col = cell % size;
        switch (side) {
            case 0: return row > 0 ? cell - size : -1;
            case 1: return col < size - 1 ? cell + 1 : -1;
            case 2: return row < size - 1 ? cell + size : -1;
            default: return col > 0 ? cell - 1 : -1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many rivers to try before giving up. No level comes near it. */
const MOST_ATTEMPTS = 1000;

/** How many bends to try for each cell of the valley before settling for the river as it is. */
const TRIES_PER_CELL = 40;
