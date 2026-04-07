import type { BoardPhase, CupcakeCell, CupcakeKind } from './common';
import { ALL_CUPCAKE_KINDS, EMPTY_CELL, createCell } from './common';
import { GRID_ROWS, GRID_COLS } from '../data';
import type { DeepReadonly } from '#common';
import {
    SWAP_DURATION_MS,
    MATCH_PHASE_DURATION_MS,
    FALL_SPEED,
    POINTS_PER_CUPCAKE,
    CASCADE_MULTIPLIER,
} from './model-constants';
import {
    findMatches,
    fillCellsNoMatches,
    compactColumns,
    countEmptyTop,
} from './grid-helpers';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BoardModel {
    readonly rowCount: number;
    readonly colCount: number;
    readonly phase: BoardPhase;
    /** 2D row-major grid: `cells[row][col]`. */
    readonly cells: DeepReadonly<CupcakeCell[][]>;
    readonly score: number;
    /** Current cascade depth (0 when idle, 1 for first match, 2+ for cascades). */
    readonly cascadeStep: number;
    /** Cells currently being matched/removed. Empty outside 'matching' phase. */
    readonly matchedCells: readonly CupcakeCell[];
    /** Linear 0-1 progress through the match phase. 0 outside 'matching' phase. */
    readonly matchProgress: number;
    /** Duration of the match phase in ms. */
    readonly matchDurationMs: number;
    /** First cell in a swap/reverse. Undefined outside swap/reverse phases. */
    readonly swapCell1: CupcakeCell | undefined;
    /** Second cell in a swap/reverse. Undefined outside swap/reverse phases. */
    readonly swapCell2: CupcakeCell | undefined;
    /** Linear 0-1 progress through swap/reverse phase. 0 outside those phases. */
    readonly swapProgress: number;
    /** Linear 0-1 progress through settling phase. 0 outside 'settling' phase. */
    readonly settleProgress: number;
    /**
     * Per-cell origin row before settling: `settleOriginRows[row][col]`.
     * NaN when the cell is stationary. Meaningful only during 'settling' phase.
     */
    readonly settleOriginRows: DeepReadonly<number[][]>;
    /** Attempt to swap two cells. Returns true if accepted (cells adjacent, occupied, board idle). */
    trySwap(cell1: CupcakeCell, cell2: CupcakeCell): boolean;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardModelOptions {
    readonly rowCount?: number;
    readonly colCount?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardModel(options: BoardModelOptions = {}): BoardModel {
    const rowCount = options.rowCount ?? GRID_ROWS;
    const colCount = options.colCount ?? GRID_COLS;

    // 2D row-major grid: cells[row][col].
    const cells: CupcakeCell[][] = [];
    for (let r = 0; r < rowCount; r++) {
        cells[r] = new Array(colCount).fill(EMPTY_CELL);
    }

    // Parallel 2D array: origin row before settling (NaN = stationary).
    const settleOriginRows: number[][] = [];
    for (let r = 0; r < rowCount; r++) {
        settleOriginRows[r] = new Array(colCount).fill(NaN);
    }

    let boardPhase: BoardPhase = 'idle';
    let score = 0;
    let cascadeStep = 0;
    let currentMatchedCells: CupcakeCell[] = [];
    let swapCell1: CupcakeCell | undefined;
    let swapCell2: CupcakeCell | undefined;
    let phaseEndTime = 0;
    let phaseElapsed = 0;

    const phaseFinishers: Record<BoardPhase, () => void> = {
        idle: () => {},
        swapping: finishSwap,
        reversing: finishReverse,
        matching: finishMatching,
        settling: finishSettling,
    };

    fillCellsNoMatches(cells, rowCount, colCount, randomKind);

    // ---- Public record -----------------------------------------------------

    const model: BoardModel = {
        get rowCount() { return rowCount; },
        get colCount() { return colCount; },
        get phase() { return boardPhase; },
        get cells() { return cells; },
        get score() { return score; },
        get cascadeStep() { return cascadeStep; },
        get matchedCells() { return currentMatchedCells; },
        get matchProgress() {
            if (boardPhase !== 'matching' || phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },
        get matchDurationMs() { return MATCH_PHASE_DURATION_MS; },
        get swapCell1() { return swapCell1; },
        get swapCell2() { return swapCell2; },
        get swapProgress() {
            if (boardPhase !== 'swapping' && boardPhase !== 'reversing') return 0;
            if (phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },
        get settleProgress() {
            if (boardPhase !== 'settling' || phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },
        get settleOriginRows() { return settleOriginRows; },

        trySwap(cell1: CupcakeCell, cell2: CupcakeCell): boolean {
            if (boardPhase !== 'idle') return false;
            if (cell1 === EMPTY_CELL || cell2 === EMPTY_CELL) return false;

            const dr = Math.abs(cell2.row - cell1.row);
            const dc = Math.abs(cell2.col - cell1.col);
            if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;

            beginSwap(cell1, cell2);
            return true;
        },

        update(deltaMs: number): void {
            if (boardPhase === 'idle') return;
            phaseElapsed += deltaMs * 0.001;
            if (phaseElapsed >= phaseEndTime) {
                phaseFinishers[boardPhase]();
            }
        },
    };

    return model;

    // ---- Swap --------------------------------------------------------------

    function beginSwap(cell1: CupcakeCell, cell2: CupcakeCell): void {
        boardPhase = 'swapping';
        swapCell1 = cell1;
        swapCell2 = cell2;
        cascadeStep = 0;
        phaseElapsed = 0;
        phaseEndTime = SWAP_DURATION_MS * 0.001;
    }

    function finishSwap(): void {
        const r1 = swapCell1!.row, c1 = swapCell1!.col;
        const r2 = swapCell2!.row, c2 = swapCell2!.col;
        const kind1 = swapCell1!.kind;
        const kind2 = swapCell2!.kind;

        // Commit swap: create new cells with swapped kinds
        cells[r1][c1] = createCell(kind2, r1, c1);
        cells[r2][c2] = createCell(kind1, r2, c2);
        swapCell1 = cells[r1][c1];
        swapCell2 = cells[r2][c2];

        const matches = findMatches(cells, rowCount, colCount);
        if (matches.length > 0) {
            beginMatching(matches);
            return;
        }

        // No match - revert to original kinds
        cells[r1][c1] = createCell(kind1, r1, c1);
        cells[r2][c2] = createCell(kind2, r2, c2);
        swapCell1 = cells[r1][c1];
        swapCell2 = cells[r2][c2];

        boardPhase = 'reversing';
        phaseElapsed = 0;
        phaseEndTime = SWAP_DURATION_MS * 0.001;
    }

    function finishReverse(): void {
        swapCell1 = undefined;
        swapCell2 = undefined;
        boardPhase = 'idle';
    }

    // ---- Matching ----------------------------------------------------------

    function beginMatching(matchedCells: CupcakeCell[]): void {
        boardPhase = 'matching';
        cascadeStep++;
        currentMatchedCells = matchedCells;

        const multiplier = Math.pow(CASCADE_MULTIPLIER, cascadeStep - 1);
        score += Math.round(matchedCells.length * POINTS_PER_CUPCAKE * multiplier);

        phaseElapsed = 0;
        phaseEndTime = MATCH_PHASE_DURATION_MS * 0.001;
    }

    function finishMatching(): void {
        for (let i = 0; i < currentMatchedCells.length; i++) {
            const cell = currentMatchedCells[i];
            cells[cell.row][cell.col] = EMPTY_CELL;
        }
        currentMatchedCells = [];
        swapCell1 = undefined;
        swapCell2 = undefined;
        beginSettling();
    }

    // ---- Settling (gravity + refill) ---------------------------------------

    function beginSettling(): void {
        boardPhase = 'settling';

        const { sourceRows, didMove } = compactColumns(cells, rowCount, colCount);
        const emptyCounts = countEmptyTop(cells, rowCount, colCount);

        let anyRefill = false;
        for (let c = 0; c < colCount; c++) {
            for (let r = 0; r < emptyCounts[c]; r++) {
                cells[r][c] = createCell(randomKind(), r, c);
                anyRefill = true;
            }
        }

        if (!didMove && !anyRefill) {
            finishSettling();
            return;
        }

        // Stamp settleOriginRows for cells that fell and compute max fall distance
        let maxDist = 0;

        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const src = sourceRows[r][c];
                if (src < 0) {
                    settleOriginRows[r][c] = NaN;
                    continue;
                }
                settleOriginRows[r][c] = src;
                const dist = r - src;
                if (dist > maxDist) maxDist = dist;
            }
        }

        // New cells from refill get a negative settleOriginRows entry (off-screen origin)
        for (let c = 0; c < colCount; c++) {
            const ec = emptyCounts[c];
            for (let r = 0; r < ec; r++) {
                settleOriginRows[r][c] = r - ec;
                if (ec > maxDist) maxDist = ec;
            }
        }

        phaseElapsed = 0;
        phaseEndTime = (maxDist / FALL_SPEED) || 0.001;
    }

    function finishSettling(): void {
        // Clear all settleOriginRows
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                settleOriginRows[r][c] = NaN;
            }
        }

        const matches = findMatches(cells, rowCount, colCount);
        if (matches.length > 0) {
            beginMatching(matches);
        }
        else {
            boardPhase = 'idle';
        }
    }

    // ---- Random ------------------------------------------------------------

    function randomKind(): CupcakeKind {
        return ALL_CUPCAKE_KINDS[Math.floor(Math.random() * ALL_CUPCAKE_KINDS.length)];
    }
}
