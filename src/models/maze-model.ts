import type { TileKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MazeModel {
    readonly rows: number;
    readonly cols: number;
    tileAt(row: number, col: number): TileKind;
    isWall(row: number, col: number): boolean;
    isDot(row: number, col: number): boolean;
    eatDot(row: number, col: number): boolean;
    readonly remainingDots: number;
    update(deltaMs: number): void;
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

    // Flat boolean array for dot positions — no per-lookup allocation
    const dots: boolean[] = new Array(rows * cols).fill(false);
    let dotCount = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (tiles[r][c] === 'dot') {
                dots[r * cols + c] = true;
                dotCount++;
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

        isDot(row: number, col: number): boolean {
            return dots[row * cols + col] === true;
        },

        eatDot(row: number, col: number): boolean {
            const idx = row * cols + col;
            if (dots[idx]) {
                dots[idx] = false;
                dotCount--;
                return true;
            }
            return false;
        },

        get remainingDots(): number {
            return dotCount;
        },

        update(_deltaMs: number): void {
            // Maze is static — nothing to update
        },
    };

    return model;
}
