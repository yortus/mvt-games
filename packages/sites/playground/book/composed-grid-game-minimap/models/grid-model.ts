// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What fills a cell of the grid. */
export type TileKind = 'empty' | 'wall' | 'dot' | 'spike';

/**
 * A grid of tiles: walls, dots to collect, and spikes to avoid. Rows count
 * down from the top, and columns across from the left.
 */
export interface GridModel {
    readonly rows: number;
    readonly cols: number;
    /** The cell where the player starts. */
    readonly startRow: number;
    readonly startCol: number;
    /** How many dots are still to collect. */
    readonly dotsLeft: number;
    /** What fills a cell. Cells outside the grid are walls. */
    readonly tileKindAt: (row: number, col: number) => TileKind;
    /** Whether something can move into a cell: it's inside the grid, and not a wall. */
    readonly isOpenAt: (row: number, col: number) => boolean;
    /** Takes the dot from a cell, which is then empty. */
    readonly clearDotAt: (row: number, col: number) => void;
    /** Puts back every dot the layout started with. */
    readonly refill: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridModelOptions {
    /**
     * The grid, one string for each row, one letter for each cell: `#` for a
     * wall, `.` for a dot, `^` for a spike, `S` for the start, and a space
     * for an empty cell.
     */
    readonly layout: readonly string[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a grid from its layout, with every dot in place. */
export function createGridModel({ layout }: GridModelOptions): GridModel {
    const rows = layout.length;
    const cols = layout[0].length;
    const tiles: TileKind[] = [];
    let startRow = 0;
    let startCol = 0;
    let dotsLeft = 0;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (layout[row][col] !== 'S') continue;
            startRow = row;
            startCol = col;
        }
    }
    refill();

    const model: GridModel = {
        rows,
        cols,
        startRow,
        startCol,
        get dotsLeft() { return dotsLeft; },

        tileKindAt(row, col) {
            if (row < 0 || row >= rows || col < 0 || col >= cols) return 'wall';
            return tiles[row * cols + col];
        },

        isOpenAt(row, col) {
            return model.tileKindAt(row, col) !== 'wall';
        },

        clearDotAt(row, col) {
            if (model.tileKindAt(row, col) !== 'dot') return;
            tiles[row * cols + col] = 'empty';
            dotsLeft--;
        },

        refill,
    };

    return model;

    function refill(): void {
        dotsLeft = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const kind = KIND_OF_LETTER[layout[row][col]] ?? 'empty';
                tiles[row * cols + col] = kind;
                if (kind === 'dot') dotsLeft++;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KIND_OF_LETTER: Readonly<Record<string, TileKind | undefined>> = {
    '#': 'wall',
    '.': 'dot',
    '^': 'spike',
};
