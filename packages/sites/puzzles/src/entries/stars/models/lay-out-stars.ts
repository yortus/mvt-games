import type { Random } from '@mvtjs/site-kit/random';
import { EMPTY, STAR, STARS_PER_LINE } from './cell-states';
import type { StarGrid } from './star-grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LayOutStarsOptions {
    readonly grid: StarGrid;
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a random layout of stars for `grid`, with two in every row and
 * every column, and none touching, as `STAR` or `EMPTY` for each cell.
 * Regions come later, drawn around the stars. It goes row by row, choosing
 * two columns at least two apart that touch no star in the row above, and
 * backs up from a dead end. A grid of 9 by 9 or larger always has a layout.
 */
export function layOutStars(options: LayOutStarsOptions): Uint8Array {
    const { grid, random } = options;
    const { size } = grid;
    // Every pair of columns two or more apart, which a row's stars could take
    const pairs: [number, number][] = [];
    for (let a = 0; a < size; a++) {
        for (let b = a + 2; b < size; b++) pairs.push([a, b]);
    }
    const columnStars = new Int32Array(size);
    const rowPairs: [number, number][] = [];
    let steps = 0;
    if (!layOutRow(0)) throw new Error(`No layout of stars fits a ${size} by ${size} grid`);

    const solution = new Uint8Array(grid.cellCount).fill(EMPTY);
    for (let row = 0; row < size; row++) {
        solution[row * size + rowPairs[row][0]] = STAR;
        solution[row * size + rowPairs[row][1]] = STAR;
    }
    return solution;

    function layOutRow(row: number): boolean {
        if (++steps > MOST_STEPS) return false;
        if (row === size) return true;
        // Each column must still be able to get its stars from the rows left, every other row at most
        for (let col = 0; col < size; col++) {
            if (STARS_PER_LINE - columnStars[col] > Math.ceil((size - row) / 2)) return false;
        }
        const order = shuffle(pairs.slice(), random);
        const above = row > 0 ? rowPairs[row - 1] : undefined;
        for (let i = 0; i < order.length; i++) {
            const [a, b] = order[i];
            if (columnStars[a] >= STARS_PER_LINE || columnStars[b] >= STARS_PER_LINE) continue;
            if (above !== undefined && (isNear(a, above) || isNear(b, above))) continue;
            columnStars[a]++;
            columnStars[b]++;
            rowPairs.push(order[i]);
            if (layOutRow(row + 1)) return true;
            columnStars[a]--;
            columnStars[b]--;
            rowPairs.pop();
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many rows to try before giving up. No grid this game uses comes near it. */
const MOST_STEPS = 200_000;

/** Whether column `col` is within one of either column of `pair`. */
function isNear(col: number, pair: readonly [number, number]): boolean {
    return Math.abs(col - pair[0]) <= 1 || Math.abs(col - pair[1]) <= 1;
}

/** Shuffles `items` in place, and returns them. */
function shuffle<T>(items: T[], random: Random): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        const item = items[i];
        items[i] = items[j];
        items[j] = item;
    }
    return items;
}
