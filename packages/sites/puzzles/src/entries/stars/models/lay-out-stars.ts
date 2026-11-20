import type { Random } from '@mvtjs/site-kit/random';
import { EMPTY, STAR } from './cell-states';
import { type StarGrid, STARS_PER_LINE } from './star-grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `layOutStars` works from. */
export interface LayOutStarsOptions {
    /** The grid to lay the stars out on. */
    readonly grid: StarGrid;
    /** Where the random choices come from, so the same seed lays out the same stars. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a random layout of stars for `grid`, with two stars in every row
 * and every column, and none touching, as `STAR` or `EMPTY` for each cell.
 * Regions come later, drawn around the stars. It goes row by row, choosing
 * columns at least two apart that touch no star in the row above, and backs
 * up from a dead end. Every grid 8 by 8 or larger has a layout, but a
 * 7 by 7 grid doesn't. On 7 by 7, two rows side by side need four stars,
 * and the four 2x2 boxes that cover them can hold only one each. So each
 * box holds a star. The last box is just two cells of column 6, so that
 * column has a star in each of rows 0 to 1, 2 to 3 and 4 to 5. That makes
 * three stars, one too many.
 */
export function layOutStars(options: LayOutStarsOptions): Uint8Array {
    const { grid, random } = options;
    const { size } = grid;
    // Every choice of columns, each two or more from the next, that a row's stars could take
    const choices: number[][] = [];
    addChoices([], 0);
    const columnStars = new Int32Array(size);
    const rowChoices: number[][] = [];
    let steps = 0;
    if (!layOutRow(0)) throw new Error(`No layout of two stars a line fits a ${size} by ${size} grid`);

    const solution = new Uint8Array(grid.cellCount).fill(EMPTY);
    for (let row = 0; row < size; row++) {
        for (let i = 0; i < STARS_PER_LINE; i++) solution[row * size + rowChoices[row][i]] = STAR;
    }
    return solution;

    function addChoices(columns: number[], from: number): void {
        if (columns.length === STARS_PER_LINE) {
            choices.push(columns.slice());
            return;
        }
        for (let col = from; col < size; col++) {
            columns.push(col);
            addChoices(columns, col + 2);
            columns.pop();
        }
    }

    function layOutRow(row: number): boolean {
        if (++steps > MOST_STEPS) return false;
        if (row === size) return true;
        // Each column must still be able to get its stars from the rows left, every other row at most
        for (let col = 0; col < size; col++) {
            if (STARS_PER_LINE - columnStars[col] > Math.ceil((size - row) / 2)) return false;
        }
        const order = shuffle(choices.slice(), random);
        const above = row > 0 ? rowChoices[row - 1] : undefined;
        for (let i = 0; i < order.length; i++) {
            const columns = order[i];
            if (!fits(columns, above)) continue;
            for (let j = 0; j < columns.length; j++) columnStars[columns[j]]++;
            rowChoices.push(columns);
            if (layOutRow(row + 1)) return true;
            for (let j = 0; j < columns.length; j++) columnStars[columns[j]]--;
            rowChoices.pop();
        }
        return false;
    }

    /** Whether `columns` have room for another star each, and touch none of the stars in `above`. */
    function fits(columns: readonly number[], above: readonly number[] | undefined): boolean {
        for (let j = 0; j < columns.length; j++) {
            if (columnStars[columns[j]] >= STARS_PER_LINE) return false;
            if (above === undefined) continue;
            for (let k = 0; k < above.length; k++) {
                if (Math.abs(columns[j] - above[k]) <= 1) return false;
            }
        }
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many rows to try before giving up. No grid this game uses comes near it. */
const MOST_STEPS = 200_000;

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
