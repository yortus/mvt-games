// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A square grid of cells, numbered row by row from the top left, and which
 * cells are next to which. Two stars may not touch, side to side or at a
 * corner, so each cell has up to eight neighbours that matter.
 */
export interface StarGrid {
    /** How many cells along each side, and how many rows, columns and regions it has. */
    readonly size: number;
    readonly cellCount: number;
    /** Each cell's neighbours, side to side and at its corners: eight places for each cell, -1 past the edge. */
    readonly neighbours: Readonly<Int32Array>;
    /** Each cell's neighbours across its sides: four places for each cell, up, right, down and left, -1 past the edge. */
    readonly sides: Readonly<Int32Array>;
    /** Whether `a` and `b` touch, side to side or at a corner. */
    readonly isTouching: (a: number, b: number) => boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StarGridOptions {
    /** How many cells along each side. */
    readonly size: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a grid `size` cells square. */
export function createStarGrid(options: StarGridOptions): StarGrid {
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
        if (row > 0) sides[cell * 4] = cell - size;
        if (col < size - 1) sides[cell * 4 + 1] = cell + 1;
        if (row < size - 1) sides[cell * 4 + 2] = cell + size;
        if (col > 0) sides[cell * 4 + 3] = cell - 1;
    }
    return {
        size,
        cellCount,
        neighbours,
        sides,
        isTouching: (a, b) => a !== b && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1 && Math.abs((a % size) - (b % size)) <= 1,
    };
}
