// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The shape of a maze: its cells, the edges between them, and the grid lines
 * the edges lie on. Every edge between two cells is a wall or a passage. The
 * outer border is all wall, and has no edges of its own here.
 *
 * Cells are numbered row by row from the top left. The edges between cells
 * side by side come first, row by row, then the edges between cells one
 * above the other. A grid line runs between two rows or two columns of
 * cells: the lines between columns come first, left to right, each read top
 * to bottom, then the lines between rows, top to bottom, each read left to
 * right. The corners, where the grid lines meet, the border's included,
 * are numbered row by row from the top left too, `cols + 1` to a row. Every
 * array is made once, so a solver or a view can read them as often as it
 * likes.
 */
export interface MazeGrid {
    readonly rows: number;
    readonly cols: number;
    readonly cellCount: number;
    readonly edgeCount: number;
    /** How many lines there are between columns. The lines between rows follow them. */
    readonly columnLineCount: number;
    readonly lineCount: number;
    /** The cells either side of each edge: the one to the left or above, and the one to the right or below. */
    readonly edgeCellA: Readonly<Int32Array>;
    readonly edgeCellB: Readonly<Int32Array>;
    /** Each cell's four edges, at `cell * 4`: above, right, below and left, or -1 for the border. */
    readonly cellEdges: Readonly<Int32Array>;
    /** Each line's edges, in order along it. */
    readonly lineEdges: readonly Readonly<Int32Array>[];
    /** The line each edge lies on. */
    readonly edgeLine: Readonly<Int32Array>;
    /** Whether `edge` lies between two cells side by side, on a line between columns. */
    readonly isEdgeBetweenColumns: (edge: number) => boolean;
    /** The edge between two cells next to each other, or -1 if they aren't. */
    readonly edgeBetween: (cell: number, other: number) => number;
    /** The edge along the grid line between two corners next to each other, or -1 if they aren't, or the line is the border. */
    readonly edgeAlong: (corner: number, other: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MazeGridOptions {
    /** The grid's size, in cells. Each is at least 2. */
    readonly rows: number;
    readonly cols: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the grid of a maze `rows` cells high and `cols` cells wide. */
export function createMazeGrid(options: MazeGridOptions): MazeGrid {
    const { rows, cols } = options;
    const cellCount = rows * cols;
    const acrossCount = rows * (cols - 1);
    const edgeCount = acrossCount + (rows - 1) * cols;
    const columnLineCount = cols - 1;
    const lineCount = columnLineCount + rows - 1;

    const edgeCellA = new Int32Array(edgeCount);
    const edgeCellB = new Int32Array(edgeCount);
    const edgeLine = new Int32Array(edgeCount);
    const cellEdges = new Int32Array(cellCount * 4).fill(-1);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols - 1; col++) {
            const edge = row * (cols - 1) + col;
            const cell = row * cols + col;
            edgeCellA[edge] = cell;
            edgeCellB[edge] = cell + 1;
            edgeLine[edge] = col;
            cellEdges[cell * 4 + RIGHT] = edge;
            cellEdges[(cell + 1) * 4 + LEFT] = edge;
        }
    }
    for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols; col++) {
            const edge = acrossCount + row * cols + col;
            const cell = row * cols + col;
            edgeCellA[edge] = cell;
            edgeCellB[edge] = cell + cols;
            edgeLine[edge] = columnLineCount + row;
            cellEdges[cell * 4 + BELOW] = edge;
            cellEdges[(cell + cols) * 4 + ABOVE] = edge;
        }
    }
    const lineEdges: Int32Array[] = [];
    for (let line = 0; line < columnLineCount; line++) {
        lineEdges.push(Int32Array.from({ length: rows }, (_, row) => row * (cols - 1) + line));
    }
    for (let line = 0; line < rows - 1; line++) {
        lineEdges.push(Int32Array.from({ length: cols }, (_, col) => acrossCount + line * cols + col));
    }

    return {
        rows,
        cols,
        cellCount,
        edgeCount,
        columnLineCount,
        lineCount,
        edgeCellA,
        edgeCellB,
        cellEdges,
        lineEdges,
        edgeLine,
        isEdgeBetweenColumns: (edge) => edge < acrossCount,
        edgeBetween,
        edgeAlong(corner, other) {
            const low = Math.min(corner, other);
            const row = Math.floor(low / (cols + 1));
            const col = low % (cols + 1);
            const gap = Math.abs(other - corner);
            if (gap === 1 && col < cols) {
                // Along a line between rows, over the cell below it
                return row > 0 && row < rows ? edgeBetween((row - 1) * cols + col, row * cols + col) : -1;
            }
            if (gap === cols + 1) {
                // Along a line between columns, beside the cell to its right
                return col > 0 && col < cols && row < rows ? edgeBetween(row * cols + col - 1, row * cols + col) : -1;
            }
            return -1;
        },
    };

    function edgeBetween(cell: number, other: number): number {
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge >= 0 && (edgeCellA[edge] === other || edgeCellB[edge] === other)) return edge;
        }
        return -1;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A cell's sides, in the order of its edges in `cellEdges`. */
const ABOVE = 0;
const RIGHT = 1;
const BELOW = 2;
const LEFT = 3;
