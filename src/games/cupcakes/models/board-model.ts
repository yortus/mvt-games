import type { BoardPhase, CupcakeKind, Position } from './common';
import { ALL_CUPCAKE_KINDS } from './common';
import { GRID_ROWS, GRID_COLS } from '../data';
import {
    SWAP_DURATION_MS,
    MATCH_FADE_MS,
    FALL_SPEED,
    POINTS_PER_CUPCAKE,
    CASCADE_MULTIPLIER,
} from './model-constants';
import {
    findMatches,
    fillGridNoMatches,
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
    readonly cells: readonly Readonly<CupcakeCell>[];
    readonly score: number;
    /** Indices of cells currently being matched/removed. Empty outside 'matching' phase. */
    readonly matchedIndices: readonly number[];
    /** Linear 0-1 progress through the current match removal. 0 outside 'matching' phase. */
    readonly matchProgress: number;
    /** First position in a swap/reverse. Meaningful during 'swapping' and 'reversing' phases. */
    readonly swapPos1: Readonly<Position>;
    /** Second position in a swap/reverse. Meaningful during 'swapping' and 'reversing' phases. */
    readonly swapPos2: Readonly<Position>;
    /** Linear 0-1 progress through swap/reverse phase. 0 outside those phases. */
    readonly swapProgress: number;
    /** Per-cell origin row before settling (NaN if stationary). Meaningful during 'settling' phase. */
    readonly settleOrigins: readonly number[];
    /** Linear 0-1 progress through settling phase. 0 outside 'settling' phase. */
    readonly settleProgress: number;
    /** Attempt to swap two cells. Returns true if accepted (cells adjacent, occupied, board idle). */
    trySwap(pos1: Position, pos2: Position): boolean;
    update(deltaMs: number): void;
}

export interface CupcakeCell {
    kind: CupcakeKind;
    /** Grid position (always integer). */
    pos: Position;
    /** Whether this grid position contains a cupcake. */
    isAlive: boolean;
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
    const totalCells = rowCount * colCount;

    // Grid stores cupcake kind at each position; undefined = empty
    const grid: (CupcakeKind | undefined)[] = new Array(totalCells);

    // Pre-allocated cell pool
    const cells: CupcakeCell[] = [];
    for (let i = 0; i < totalCells; i++) {
        cells.push({ kind: 'strawberry', pos: { row: 0, col: 0 }, isAlive: true });
    }

    let boardPhase: BoardPhase = 'idle';
    let score = 0;
    let cascadeStep = 0;
    let currentMatchedIndices: number[] = [];
    let swapPos1: Position = { row: -1, col: -1 };
    let swapPos2: Position = { row: -1, col: -1 };
    let phaseEndTime = 0;
    let phaseElapsed = 0;

    // Pre-allocated settle origins buffer (NaN = stationary)
    const settleOriginsBuf: number[] = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) settleOriginsBuf[i] = NaN;

    const phaseFinishers: Record<BoardPhase, () => void> = {
        idle: () => {},
        swapping: finishSwap,
        reversing: finishReverse,
        matching: finishMatching,
        settling: finishSettling,
    };

    fillGridNoMatches(grid, rowCount, colCount, randomKind);
    syncCellsFromGrid();

    // ---- Public record -----------------------------------------------------

    const model: BoardModel = {
        get rowCount() { return rowCount; },
        get colCount() { return colCount; },
        get phase() { return boardPhase; },
        get cells() { return cells; },
        get score() { return score; },
        get matchedIndices() { return currentMatchedIndices; },
        get matchProgress() {
            if (boardPhase !== 'matching' || phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },
        get swapPos1() { return swapPos1; },
        get swapPos2() { return swapPos2; },
        get swapProgress() {
            if (boardPhase !== 'swapping' && boardPhase !== 'reversing') return 0;
            if (phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },
        get settleOrigins() { return settleOriginsBuf; },
        get settleProgress() {
            if (boardPhase !== 'settling' || phaseEndTime <= 0) return 0;
            return Math.min(1, phaseElapsed / phaseEndTime);
        },

        trySwap(pos1: Position, pos2: Position): boolean {
            if (boardPhase !== 'idle') return false;
            if (pos1.row < 0 || pos1.row >= rowCount || pos1.col < 0 || pos1.col >= colCount) return false;
            if (pos2.row < 0 || pos2.row >= rowCount || pos2.col < 0 || pos2.col >= colCount) return false;

            const dr = Math.abs(pos2.row - pos1.row);
            const dc = Math.abs(pos2.col - pos1.col);
            if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;

            if (grid[pos1.row * colCount + pos1.col] === undefined) return false;
            if (grid[pos2.row * colCount + pos2.col] === undefined) return false;

            beginSwap(pos1, pos2);
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

    function beginSwap(pos1: Position, pos2: Position): void {
        boardPhase = 'swapping';
        swapPos1 = { ...pos1 };
        swapPos2 = { ...pos2 };
        cascadeStep = 0;
        phaseElapsed = 0;
        phaseEndTime = SWAP_DURATION_MS * 0.001;
    }

    function finishSwap(): void {
        const idx1 = swapPos1.row * colCount + swapPos1.col;
        const idx2 = swapPos2.row * colCount + swapPos2.col;

        // Commit swap to grid
        const temp = grid[idx1];
        grid[idx1] = grid[idx2];
        grid[idx2] = temp;
        syncCellsFromGrid();

        const matches = findMatches(grid, rowCount, colCount);
        if (matches.length > 0) {
            beginMatching(matches);
            return;
        }

        // No match - revert grid then begin reversal
        grid[idx2] = grid[idx1];
        grid[idx1] = temp;
        syncCellsFromGrid();

        boardPhase = 'reversing';
        phaseElapsed = 0;
        phaseEndTime = SWAP_DURATION_MS * 0.001;
    }

    function finishReverse(): void {
        syncCellsFromGrid();
        boardPhase = 'idle';
    }

    // ---- Matching ----------------------------------------------------------

    function beginMatching(matches: number[]): void {
        boardPhase = 'matching';
        cascadeStep++;
        currentMatchedIndices = matches;

        const multiplier = Math.pow(CASCADE_MULTIPLIER, cascadeStep - 1);
        score += Math.round(matches.length * POINTS_PER_CUPCAKE * multiplier);

        phaseElapsed = 0;
        phaseEndTime = MATCH_FADE_MS * 0.001;
    }

    function finishMatching(): void {
        for (let i = 0; i < currentMatchedIndices.length; i++) {
            grid[currentMatchedIndices[i]] = undefined;
        }
        currentMatchedIndices = [];
        beginSettling();
    }

    // ---- Settling (gravity + refill) ---------------------------------------

    function beginSettling(): void {
        boardPhase = 'settling';

        const { sourceRows, didMove } = compactColumns(grid, rowCount, colCount);
        const emptyCounts = countEmptyTop(grid, rowCount, colCount);

        let anyRefill = false;
        for (let c = 0; c < colCount; c++) {
            for (let r = 0; r < emptyCounts[c]; r++) {
                grid[r * colCount + c] = randomKind();
                anyRefill = true;
            }
        }

        if (!didMove && !anyRefill) {
            finishSettling();
            return;
        }

        syncCellsFromGrid();

        // Build settle origins and compute max fall distance
        let maxDist = 0;
        for (let i = 0; i < totalCells; i++) settleOriginsBuf[i] = NaN;

        for (let i = 0; i < totalCells; i++) {
            const src = sourceRows[i];
            if (src < 0) continue;
            settleOriginsBuf[i] = src;
            const r = Math.floor(i / colCount);
            const dist = r - src;
            if (dist > maxDist) maxDist = dist;
        }

        for (let c = 0; c < colCount; c++) {
            const ec = emptyCounts[c];
            for (let r = 0; r < ec; r++) {
                settleOriginsBuf[r * colCount + c] = r - ec;
                if (ec > maxDist) maxDist = ec;
            }
        }

        phaseElapsed = 0;
        phaseEndTime = (maxDist / FALL_SPEED) || 0.001;
    }

    function finishSettling(): void {
        for (let i = 0; i < totalCells; i++) settleOriginsBuf[i] = NaN;
        syncCellsFromGrid();

        const matches = findMatches(grid, rowCount, colCount);
        if (matches.length > 0) {
            beginMatching(matches);
        }
        else {
            boardPhase = 'idle';
        }
    }

    // ---- Helpers -----------------------------------------------------------

    function syncCellsFromGrid(): void {
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const idx = r * colCount + c;
                const kind = grid[idx];
                const cell = cells[idx];
                cell.kind = kind ?? 'strawberry';
                cell.pos = { row: r, col: c };
                cell.isAlive = kind !== undefined;
            }
        }
    }

    function randomKind(): CupcakeKind {
        return ALL_CUPCAKE_KINDS[Math.floor(Math.random() * ALL_CUPCAKE_KINDS.length)];
    }
}
