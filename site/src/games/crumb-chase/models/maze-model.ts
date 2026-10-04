import type { TileKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MazeModel {
    readonly rows: number;
    readonly cols: number;
    tileAt: (row: number, col: number) => TileKind;
    isWall: (row: number, col: number) => boolean;
    isCrumb: (row: number, col: number) => boolean;
    eatCrumb: (row: number, col: number) => boolean;
    readonly remainingCrumbs: number;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MazeModelOptions {
    grid: TileKind[][];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMazeModel(options: MazeModelOptions): MazeModel {
    const { grid } = options;
    const rows = grid.length;
    const cols = grid[0].length;

    // Clone the grid so we own the data
    const tiles: TileKind[][] = grid.map((row) => [...row]);

    // Flat boolean array for crumb positions - no per-lookup allocation
    const crumbs: boolean[] = new Array(rows * cols).fill(false);
    let crumbCount = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (tiles[r][c] === 'crumb') {
                crumbs[r * cols + c] = true;
                crumbCount++;
            }
        }
    }

    const model: MazeModel = {
        rows,
        cols,

        tileAt(row: number, col: number): TileKind {
            if (row < 0 || row >= rows || col < 0 || col >= cols) {
                return 'wall'; // treat out-of-bounds as wall
            }
            return tiles[row][col];
        },

        isWall(row: number, col: number): boolean {
            return model.tileAt(row, col) === 'wall';
        },

        isCrumb(row: number, col: number): boolean {
            return crumbs[row * cols + col] === true;
        },

        eatCrumb(row: number, col: number): boolean {
            const idx = row * cols + col;
            if (crumbs[idx]) {
                crumbs[idx] = false;
                crumbCount--;
                return true;
            }
            return false;
        },

        get remainingCrumbs(): number {
            return crumbCount;
        },

        update(_deltaMs: number): void {
            // Maze is static - nothing to update
        },
    };

    return model;
}
