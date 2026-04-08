import type { CactusCell, CactusKind } from './common';
import { EMPTY_CELL, createCell } from './common';
import type { DeepReadonly } from '#common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CompactResult {
    /** For each [row][col], the row it originated from (-1 if it didn't move). */
    readonly sourceRows: DeepReadonly<number[][]>;
    /** Whether any cactus shifted down. */
    readonly didMove: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Find all cells that are part of 3+ horizontal or vertical runs. */
export function findMatches(
    cells: DeepReadonly<CactusCell[][]>,
    rowCount: number,
    colCount: number,
): CactusCell[] {
    const matched = new Uint8Array(rowCount * colCount);

    // Horizontal
    for (let r = 0; r < rowCount; r++) {
        let runStart = 0;
        let runKind = kindAt(cells[r][0]);
        for (let c = 1; c <= colCount; c++) {
            const kind = c < colCount ? kindAt(cells[r][c]) : undefined;
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
        let runKind = kindAt(cells[0][c]);
        for (let r = 1; r <= rowCount; r++) {
            const kind = r < rowCount ? kindAt(cells[r][c]) : undefined;
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

    const result: CactusCell[] = [];
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            if (matched[r * colCount + c]) result.push(cells[r][c]);
        }
    }
    return result;
}

/**
 * Check whether placing `kind` at (row, col) would form a 3+ match.
 * Only checks leftward and upward - suitable for sequential fill from top-left.
 */
export function wouldMatchAt(
    cells: DeepReadonly<CactusCell[][]>,
    row: number,
    col: number,
    kind: CactusKind,
): boolean {
    if (col >= 2
        && kindAt(cells[row][col - 1]) === kind
        && kindAt(cells[row][col - 2]) === kind) return true;
    if (row >= 2
        && kindAt(cells[row - 1][col]) === kind
        && kindAt(cells[row - 2][col]) === kind) return true;
    return false;
}

/** Fill every cell position with a random kind, avoiding any 3+ matches. */
export function fillCellsNoMatches(
    cells: CactusCell[][],
    rowCount: number,
    colCount: number,
    randomKind: () => CactusKind,
): void {
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            let kind: CactusKind;
            do {
                kind = randomKind();
            } while (wouldMatchAt(cells, r, c, kind));
            cells[r][c] = createCell(kind, r, c);
        }
    }
}

/** Compact each column so cactii fall to fill gaps. Modifies `cells` in place. */
export function compactColumns(
    cells: CactusCell[][],
    rowCount: number,
    colCount: number,
): CompactResult {
    const sourceRows: number[][] = [];
    for (let r = 0; r < rowCount; r++) {
        sourceRows[r] = new Array(colCount).fill(-1);
    }
    let didMove = false;

    for (let c = 0; c < colCount; c++) {
        let writeRow = rowCount - 1;
        for (let r = rowCount - 1; r >= 0; r--) {
            if (cells[r][c] !== EMPTY_CELL) {
                if (writeRow !== r) {
                    cells[writeRow][c] = createCell(cells[r][c].kind, writeRow, c);
                    cells[r][c] = EMPTY_CELL;
                    sourceRows[writeRow][c] = r;
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
    cells: DeepReadonly<CactusCell[][]>,
    rowCount: number,
    colCount: number,
): number[] {
    const counts: number[] = [];
    for (let c = 0; c < colCount; c++) {
        let count = 0;
        for (let r = 0; r < rowCount; r++) {
            if (cells[r][c] === EMPTY_CELL) count++;
            else break;
        }
        counts.push(count);
    }
    return counts;
}

/**
 * Check whether any single adjacent swap produces a 3+ match.
 * Only tests rightward and downward swaps to avoid duplicate checks.
 */
export function hasAvailableMove(
    cells: DeepReadonly<CactusCell[][]>,
    rowCount: number,
    colCount: number,
): boolean {
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            const cell = cells[r][c];
            if (cell === EMPTY_CELL) continue;
            // Try swap right
            if (c + 1 < colCount) {
                const right = cells[r][c + 1];
                if (right !== EMPTY_CELL && right.kind !== cell.kind) {
                    if (wouldMatchAfterSwap(cells, rowCount, colCount, r, c, r, c + 1)) return true;
                }
            }
            // Try swap down
            if (r + 1 < rowCount) {
                const below = cells[r + 1][c];
                if (below !== EMPTY_CELL && below.kind !== cell.kind) {
                    if (wouldMatchAfterSwap(cells, rowCount, colCount, r, c, r + 1, c)) return true;
                }
            }
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function kindAt(cell: CactusCell): CactusKind | undefined {
    return cell === EMPTY_CELL ? undefined : cell.kind;
}

/**
 * Check whether swapping (r1,c1) with (r2,c2) would create a 3+ run
 * for either cell in its new position. Does not mutate the grid.
 */
function wouldMatchAfterSwap(
    cells: DeepReadonly<CactusCell[][]>,
    rowCount: number,
    colCount: number,
    r1: number, c1: number,
    r2: number, c2: number,
): boolean {
    const kind1 = cells[r1][c1].kind;
    const kind2 = cells[r2][c2].kind;
    // Check kind2 placed at (r1,c1)
    if (formsMatchAt(cells, rowCount, colCount, r1, c1, kind2, r2, c2)) return true;
    // Check kind1 placed at (r2,c2)
    if (formsMatchAt(cells, rowCount, colCount, r2, c2, kind1, r1, c1)) return true;
    return false;
}

/**
 * Check whether placing `kind` at (row, col) forms a run of 3+ in any direction.
 * `swapRow`/`swapCol` is the other cell in the swap (read as `kind` of the original cell).
 */
function formsMatchAt(
    cells: DeepReadonly<CactusCell[][]>,
    rowCount: number,
    colCount: number,
    row: number, col: number,
    kind: CactusKind,
    swapRow: number, swapCol: number,
): boolean {
    // For each axis, count consecutive cells with matching kind in both directions.
    // The "other" swap cell is treated as having the swapped-in kind.
    const otherKind = cells[row][col].kind; // kind that moved to (swapRow, swapCol)

    // Horizontal
    let hCount = 1;
    for (let c = col - 1; c >= 0; c--) {
        if (!kindMatches(cells, c, row, col, kind, swapRow, swapCol, otherKind)) break;
        hCount++;
    }
    for (let c = col + 1; c < colCount; c++) {
        if (!kindMatches(cells, c, row, col, kind, swapRow, swapCol, otherKind)) break;
        hCount++;
    }
    if (hCount >= 3) return true;

    // Vertical
    let vCount = 1;
    for (let r = row - 1; r >= 0; r--) {
        if (!kindMatchesV(cells, r, col, row, col, kind, swapRow, swapCol, otherKind)) break;
        vCount++;
    }
    for (let r = row + 1; r < rowCount; r++) {
        if (!kindMatchesV(cells, r, col, row, col, kind, swapRow, swapCol, otherKind)) break;
        vCount++;
    }
    if (vCount >= 3) return true;

    return false;
}

/** Check if column `c` at `row` matches `kind`, accounting for the swap. */
function kindMatches(
    cells: DeepReadonly<CactusCell[][]>,
    c: number,
    row: number,
    _selfCol: number,
    kind: CactusKind,
    swapRow: number,
    swapCol: number,
    otherKind: CactusKind,
): boolean {
    if (row === swapRow && c === swapCol) return otherKind === kind;
    const cell = cells[row][c];
    if (cell === EMPTY_CELL) return false;
    return cell.kind === kind;
}

/** Check if row `r` at `col` matches `kind`, accounting for the swap. */
function kindMatchesV(
    cells: DeepReadonly<CactusCell[][]>,
    r: number,
    col: number,
    _selfRow: number,
    _selfCol: number,
    kind: CactusKind,
    swapRow: number,
    swapCol: number,
    otherKind: CactusKind,
): boolean {
    if (r === swapRow && col === swapCol) return otherKind === kind;
    const cell = cells[r][col];
    if (cell === EMPTY_CELL) return false;
    return cell.kind === kind;
}
