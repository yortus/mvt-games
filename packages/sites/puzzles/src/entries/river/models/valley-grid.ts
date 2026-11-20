// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The shape of a valley: its cells, and the edges between them that the
 * river can cross. Cells are numbered row by row from the top left. The
 * edges between cells side by side come first, row by row, then the edges
 * between cells one above the other. The valley's border has no edges here,
 * since the river crosses it only at its two ends, which the puzzle says.
 * Every array is made once, so a solver or a view can read them as often as
 * it likes.
 */
export interface ValleyGrid {
    /** How many cells along each side. */
    readonly size: number;
    /** How many cells it has: `size` squared. */
    readonly cellCount: number;
    /** How many edges it has between its cells. */
    readonly edgeCount: number;
    /** The cells either side of each edge: the one to the left or above, and the one to the right or below. */
    readonly edgeCellA: Readonly<Int32Array>;
    readonly edgeCellB: Readonly<Int32Array>;
    /** Each cell's four edges, at `cell * 4`: up, right, down and left, or -1 at the border. */
    readonly cellEdges: Readonly<Int32Array>;
    /** Whether `edge` lies between two cells side by side, rather than one above the other. */
    readonly isEdgeAcross: (edge: number) => boolean;
    /** The edge between two cells next to each other, or -1 if they aren't. */
    readonly edgeBetween: (cell: number, other: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a valley is created with. */
export interface ValleyGridOptions {
    /** How many cells along each side. At least 2. */
    readonly size: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a valley `size` cells square. */
export function createValleyGrid(options: ValleyGridOptions): ValleyGrid {
    const { size } = options;
    const cellCount = size * size;
    const acrossCount = size * (size - 1);
    const edgeCount = acrossCount * 2;
    const edgeCellA = new Int32Array(edgeCount);
    const edgeCellB = new Int32Array(edgeCount);
    const cellEdges = new Int32Array(cellCount * 4).fill(-1);
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size - 1; col++) {
            const edge = row * (size - 1) + col;
            const cell = row * size + col;
            edgeCellA[edge] = cell;
            edgeCellB[edge] = cell + 1;
            cellEdges[cell * 4 + RIGHT] = edge;
            cellEdges[(cell + 1) * 4 + LEFT] = edge;
        }
    }
    for (let row = 0; row < size - 1; row++) {
        for (let col = 0; col < size; col++) {
            const edge = acrossCount + row * size + col;
            const cell = row * size + col;
            edgeCellA[edge] = cell;
            edgeCellB[edge] = cell + size;
            cellEdges[cell * 4 + DOWN] = edge;
            cellEdges[(cell + size) * 4 + UP] = edge;
        }
    }
    return {
        size,
        cellCount,
        edgeCount,
        edgeCellA,
        edgeCellB,
        cellEdges,
        isEdgeAcross: (edge) => edge < acrossCount,
        edgeBetween(cell, other) {
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0 && (edgeCellA[edge] === other || edgeCellB[edge] === other)) return edge;
            }
            return -1;
        },
    };
}

/** A cell's sides, in the order of its edges in `cellEdges`. Opposite sides are two apart. */
export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;
