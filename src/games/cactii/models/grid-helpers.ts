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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function kindAt(cell: CactusCell): CactusKind | undefined {
    return cell === EMPTY_CELL ? undefined : cell.kind;
}
