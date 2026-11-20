// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A square harbour of cells, numbered row by row from the top left, and
 * which cells are next to which. Boats may not touch, side to side or
 * diagonally, so each cell has up to eight neighbours that matter, and a
 * boat runs straight, across or down, so the four across its sides matter
 * most.
 */
export interface HarbourGrid {
    /** How many cells along each side. */
    readonly size: number;
    /** How many cells it has: `size` squared. */
    readonly cellCount: number;
    /** Each cell's neighbours, side to side and diagonally: eight places for each cell, -1 past the edge. */
    readonly neighbours: Readonly<Int32Array>;
    /** Each cell's neighbours across its sides: four places for each cell, up, right, down and left, -1 past the edge. */
    readonly sides: Readonly<Int32Array>;
}

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

/** A cell's sides, in the order of its neighbours in `sides`. Opposite sides are two apart. */
export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;
