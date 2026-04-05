import type { CupcakeKind } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CompactResult {
    /** For each cell index, the row it originated from (-1 if it didn't move). */
    readonly sourceRows: readonly number[];
    /** Whether any cupcake shifted down. */
    readonly didMove: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Find all cells that are part of 3+ horizontal or vertical runs. */
export function findMatches(
    grid: readonly (CupcakeKind | undefined)[],
    rowCount: number,
    colCount: number,
): number[] {
    const totalCells = rowCount * colCount;
    const matched = new Uint8Array(totalCells);

    // Horizontal
    for (let r = 0; r < rowCount; r++) {
        let runStart = 0;
        let runKind = grid[r * colCount];
        for (let c = 1; c <= colCount; c++) {
            const kind = c < colCount ? grid[r * colCount + c] : undefined;
            if (kind === runKind && kind !== undefined) continue;

            if (c - runStart >= 3 && runKind !== undefined) {
                for (let k = runStart; k < c; k++) {
                    matched[r * colCount + k] = 1;
                }
            }
            runStart = c;
            runKind = kind;
        }
    }

    // Vertical
    for (let c = 0; c < colCount; c++) {
        let runStart = 0;
        let runKind = grid[c];
        for (let r = 1; r <= rowCount; r++) {
            const kind = r < rowCount ? grid[r * colCount + c] : undefined;
            if (kind === runKind && kind !== undefined) continue;

            if (r - runStart >= 3 && runKind !== undefined) {
                for (let k = runStart; k < r; k++) {
                    matched[k * colCount + c] = 1;
                }
            }
            runStart = r;
            runKind = kind;
        }
    }

    const result: number[] = [];
    for (let i = 0; i < totalCells; i++) {
        if (matched[i]) result.push(i);
    }
    return result;
}

/**
 * Check whether placing `kind` at (row, col) would form a 3+ match.
 * Only checks leftward and upward - suitable for sequential fill from top-left.
 */
export function wouldMatchAt(
    grid: readonly (CupcakeKind | undefined)[],
    colCount: number,
    row: number,
    col: number,
    kind: CupcakeKind,
): boolean {
    if (col >= 2
        && grid[row * colCount + col - 1] === kind
        && grid[row * colCount + col - 2] === kind) return true;
    if (row >= 2
        && grid[(row - 1) * colCount + col] === kind
        && grid[(row - 2) * colCount + col] === kind) return true;
    return false;
}

/** Fill every cell in the grid with a random kind, avoiding any 3+ matches. */
export function fillGridNoMatches(
    grid: (CupcakeKind | undefined)[],
    rowCount: number,
    colCount: number,
    randomKind: () => CupcakeKind,
): void {
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            let kind: CupcakeKind;
            do {
                kind = randomKind();
            } while (wouldMatchAt(grid, colCount, r, c, kind));
            grid[r * colCount + c] = kind;
        }
    }
}

/** Compact each column so cupcakes fall to fill gaps. Modifies `grid` in place. */
export function compactColumns(
    grid: (CupcakeKind | undefined)[],
    rowCount: number,
    colCount: number,
): CompactResult {
    const totalCells = rowCount * colCount;
    const sourceRows: number[] = new Array(totalCells).fill(-1);
    let didMove = false;

    for (let c = 0; c < colCount; c++) {
        let writeRow = rowCount - 1;
        for (let r = rowCount - 1; r >= 0; r--) {
            const idx = r * colCount + c;
            if (grid[idx] !== undefined) {
                const destIdx = writeRow * colCount + c;
                if (writeRow !== r) {
                    grid[destIdx] = grid[idx];
                    grid[idx] = undefined;
                    sourceRows[destIdx] = r;
                    didMove = true;
                }
                writeRow--;
            }
        }
    }

    return { sourceRows, didMove };
}

/** Count empty cells at the top of each column (contiguous from row 0). */
export function countEmptyTop(
    grid: readonly (CupcakeKind | undefined)[],
    rowCount: number,
    colCount: number,
): number[] {
    const counts: number[] = [];
    for (let c = 0; c < colCount; c++) {
        let count = 0;
        for (let r = 0; r < rowCount; r++) {
            if (grid[r * colCount + c] === undefined) count++;
            else break;
        }
        counts.push(count);
    }
    return counts;
}
