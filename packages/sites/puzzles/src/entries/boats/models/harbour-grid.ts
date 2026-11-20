// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A square harbour of cells, numbered row by row from the top left, and
 * which cells are next to which. Boats may not touch, side to side or
 * diagonally, so each cell has up to eight neighbours that matter. A boat
 * runs straight, across or down, so the four neighbours across a cell's
 * sides matter most.
 */
export interface HarbourGrid {
    /** How many cells along each side. */
    readonly size: number;
    /** How many cells it has, which is `size` squared. */
    readonly cellCount: number;
    /**
     * Each cell's neighbours, side to side and diagonally. It holds eight
     * entries for each cell, in the order up-left, up, up-right, left,
     * right, down-left, down and down-right, and -1 past the edge.
     */
    readonly neighbours: Readonly<Int32Array>;
    /**
     * Each cell's neighbours across its sides. It holds four entries for
     * each cell, in the order `UP`, `RIGHT`, `DOWN` and `LEFT`, and -1 past
     * the edge.
     */
    readonly sides: Readonly<Int32Array>;
}

/** Where the neighbour above a cell is, among its four in `HarbourGrid.sides`. Opposite sides are two apart. */
export const UP = 0;

/** Where the neighbour to the right of a cell is, among its four in `HarbourGrid.sides`. */
export const RIGHT = 1;

/** Where the neighbour below a cell is, among its four in `HarbourGrid.sides`. */
export const DOWN = 2;

/** Where the neighbour to the left of a cell is, among its four in `HarbourGrid.sides`. */
export const LEFT = 3;

/** Where a cell's four diagonal neighbours are, among its eight in `HarbourGrid.neighbours`. */
export const DIAGONALS: readonly number[] = [0, 2, 5, 7];

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a harbour is created with. */
export interface HarbourGridOptions {
    /** How many cells along each side. */
    readonly size: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a harbour `size` cells square. */
export function createHarbourGrid(options: HarbourGridOptions): HarbourGrid {
    const { size } = options;
    const cellCount = size * size;
    const neighbours = new Int32Array(cellCount * 8).fill(-1);
    const sides = new Int32Array(cellCount * 4).fill(-1);
    for (let cell = 0; cell < cellCount; cell++) {
        const row = Math.floor(cell / size);
        const col = cell % size;
        let k = 0;
        for (let dRow = -1; dRow <= 1; dRow++) {
            for (let dCol = -1; dCol <= 1; dCol++) {
                if (dRow === 0 && dCol === 0) continue;
                const r = row + dRow;
                const c = col + dCol;
                if (r >= 0 && r < size && c >= 0 && c < size) neighbours[cell * 8 + k] = r * size + c;
                k++;
            }
        }
        if (row > 0) sides[cell * 4 + UP] = cell - size;
        if (col < size - 1) sides[cell * 4 + RIGHT] = cell + 1;
        if (row < size - 1) sides[cell * 4 + DOWN] = cell + size;
        if (col > 0) sides[cell * 4 + LEFT] = cell - 1;
    }
    return { size, cellCount, neighbours, sides };
}

/**
 * Returns the cell just before a straight run of two or more cells, or -1
 * past the edge. `first` and `last` are the run's lowest and highest cells.
 * The run goes down if they are in different rows, and across if not. The
 * cell before it is above `first` or to its left.
 */
export function findCellBeforeRun(grid: HarbourGrid, first: number, last: number): number {
    return grid.sides[first * 4 + (last - first >= grid.size ? UP : LEFT)];
}

/**
 * Returns the cell just after a straight run of two or more cells, or -1
 * past the edge. `first` and `last` are the run's lowest and highest cells,
 * as for `findCellBeforeRun`. The cell after it is below `last` or to its
 * right.
 */
export function findCellAfterRun(grid: HarbourGrid, first: number, last: number): number {
    return grid.sides[last * 4 + (last - first >= grid.size ? DOWN : RIGHT)];
}
