import gsap from 'gsap';
import type { BoardPhase, CupcakeKind } from './common';
import { ALL_CUPCAKE_KINDS } from './common';
import {
    GRID_ROWS,
    GRID_COLS,
    SWAP_DURATION_MS,
    MATCH_FADE_MS,
    FALL_SPEED,
    POINTS_PER_CUPCAKE,
    CASCADE_MULTIPLIER,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CupcakeCell {
    readonly kind: CupcakeKind;
    /** Current visual row (fractional during animation). */
    readonly row: number;
    /** Current visual col (fractional during animation). */
    readonly col: number;
    /** Visual opacity (0-1, fades out during match removal). */
    readonly alpha: number;
    /** Whether this cell is part of the current selection. */
    readonly isSelected: boolean;
}

export interface BoardModel {
    readonly rows: number;
    readonly cols: number;
    readonly phase: BoardPhase;
    readonly cells: readonly CupcakeCell[];
    readonly score: number;
    readonly selectedRow: number;
    readonly selectedCol: number;
    /** Select a cell. If adjacent to current selection, attempt a swap. */
    selectCell(row: number, col: number): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardModelOptions {
    readonly rows?: number;
    readonly cols?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardModel(options: BoardModelOptions = {}): BoardModel {
    const rows = options.rows ?? GRID_ROWS;
    const cols = options.cols ?? GRID_COLS;
    const totalCells = rows * cols;

    // Grid stores cupcake kind at each position; undefined = empty
    const grid: (CupcakeKind | undefined)[] = new Array(totalCells);

    // Visual cells for rendering - pre-allocated pool
    const cells: MutableCell[] = [];
    for (let i = 0; i < totalCells; i++) {
        cells.push({ kind: 'strawberry', row: 0, col: 0, alpha: 1, isSelected: false });
    }

    let boardPhase: BoardPhase = 'idle';
    let score = 0;
    let cascadeStep = 0;
    let selRow = -1;
    let selCol = -1;
    let swapRow1 = -1;
    let swapCol1 = -1;
    let swapRow2 = -1;
    let swapCol2 = -1;
    let phaseEndTime = 0;
    let phaseElapsed = 0;

    let timeline = gsap.timeline({ paused: true });

    // Initialise grid with no initial matches
    fillGridNoMatches();
    syncCellsFromGrid();

    // ---- Public record -----------------------------------------------------

    const model: BoardModel = {
        get rows() { return rows; },
        get cols() { return cols; },
        get phase() { return boardPhase; },
        get cells() { return cells; },
        get score() { return score; },
        get selectedRow() { return selRow; },
        get selectedCol() { return selCol; },

        selectCell(row: number, col: number): void {
            if (boardPhase !== 'idle') return;
            if (row < 0 || row >= rows || col < 0 || col >= cols) return;

            // No cupcake at this position
            if (grid[row * cols + col] === undefined) return;

            // Nothing selected yet
            if (selRow < 0) {
                selRow = row;
                selCol = col;
                markSelected();
                return;
            }

            // Tap same cell - deselect
            if (selRow === row && selCol === col) {
                clearSelection();
                return;
            }

            // Check adjacency
            const dr = Math.abs(row - selRow);
            const dc = Math.abs(col - selCol);
            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                // Adjacent - attempt swap
                beginSwap(selRow, selCol, row, col);
            }
            else {
                // Not adjacent - move selection
                selRow = row;
                selCol = col;
                markSelected();
            }
        },

        update(deltaMs: number): void {
            if (boardPhase === 'idle') return;

            const dt = deltaMs * 0.001;
            phaseElapsed += dt;
            timeline.time(phaseElapsed);

            if (boardPhase === 'swapping' && phaseElapsed >= phaseEndTime) {
                finishSwap();
            }
            else if (boardPhase === 'reversing' && phaseElapsed >= phaseEndTime) {
                finishReverse();
            }
            else if (boardPhase === 'matching' && phaseElapsed >= phaseEndTime) {
                finishMatching();
            }
            else if (boardPhase === 'falling' && phaseElapsed >= phaseEndTime) {
                finishFalling();
            }
            else if (boardPhase === 'refilling' && phaseElapsed >= phaseEndTime) {
                finishRefilling();
            }
        },
    };

    return model;

    // ---- Selection helpers -------------------------------------------------

    function clearSelection(): void {
        selRow = -1;
        selCol = -1;
        for (let i = 0; i < totalCells; i++) {
            cells[i].isSelected = false;
        }
    }

    function markSelected(): void {
        for (let i = 0; i < totalCells; i++) {
            cells[i].isSelected = false;
        }
        if (selRow >= 0) {
            cells[selRow * cols + selCol].isSelected = true;
        }
    }

    // ---- Swap --------------------------------------------------------------

    function beginSwap(r1: number, c1: number, r2: number, c2: number): void {
        boardPhase = 'swapping';
        swapRow1 = r1;
        swapCol1 = c1;
        swapRow2 = r2;
        swapCol2 = c2;
        cascadeStep = 0;
        clearSelection();

        const cell1 = cells[r1 * cols + c1];
        const cell2 = cells[r2 * cols + c2];
        const dur = SWAP_DURATION_MS * 0.001;

        resetTimeline();
        timeline.to(cell1, { row: r2, col: c2, duration: dur, ease: 'power1.inOut' }, 0);
        timeline.to(cell2, { row: r1, col: c1, duration: dur, ease: 'power1.inOut' }, 0);
        phaseEndTime = dur;
    }

    function finishSwap(): void {
        // Commit the swap in the grid
        const idx1 = swapRow1 * cols + swapCol1;
        const idx2 = swapRow2 * cols + swapCol2;
        const temp = grid[idx1];
        grid[idx1] = grid[idx2];
        grid[idx2] = temp;

        // Snap visual cells
        syncCellsFromGrid();

        // Check for matches
        const matches = findMatches();
        if (matches.length > 0) {
            beginMatching(matches);
        }
        else {
            // No match - reverse the swap
            boardPhase = 'reversing';
            grid[idx2] = grid[idx1];
            grid[idx1] = temp;

            const cell1 = cells[idx1];
            const cell2 = cells[idx2];
            // Cell positions were snapped, so re-animate the reversal
            cell1.row = swapRow2;
            cell1.col = swapCol2;
            cell2.row = swapRow1;
            cell2.col = swapCol1;

            const dur = SWAP_DURATION_MS * 0.001;
            resetTimeline();
            timeline.to(cell1, { row: swapRow1, col: swapCol1, duration: dur, ease: 'power1.inOut' }, 0);
            timeline.to(cell2, { row: swapRow2, col: swapCol2, duration: dur, ease: 'power1.inOut' }, 0);
            phaseEndTime = dur;
        }
    }

    function finishReverse(): void {
        syncCellsFromGrid();
        boardPhase = 'idle';
    }

    // ---- Matching ----------------------------------------------------------

    function beginMatching(matches: number[]): void {
        boardPhase = 'matching';
        cascadeStep++;

        // Score the match
        const multiplier = Math.pow(CASCADE_MULTIPLIER, cascadeStep - 1);
        score += Math.round(matches.length * POINTS_PER_CUPCAKE * multiplier);

        // Animate matched cells fading out
        const dur = MATCH_FADE_MS * 0.001;
        resetTimeline();
        for (let i = 0; i < matches.length; i++) {
            const idx = matches[i];
            timeline.to(cells[idx], { alpha: 0, duration: dur, ease: 'power1.out' }, 0);
        }
        phaseEndTime = dur;
    }

    function finishMatching(): void {
        // Remove matched cupcakes from grid
        for (let i = 0; i < totalCells; i++) {
            if (cells[i].alpha <= 0) {
                grid[i] = undefined;
            }
        }
        // Begin falling
        beginFalling();
    }

    // ---- Falling -----------------------------------------------------------

    function beginFalling(): void {
        boardPhase = 'falling';
        let anyFall = false;
        let maxDur = 0;

        // Track where each cell originated: sourceRow[destIdx] = original row
        const sourceRow: number[] = new Array(totalCells).fill(-1);

        // Process each column: shift cupcakes down to fill gaps
        for (let c = 0; c < cols; c++) {
            let writeRow = rows - 1;
            for (let r = rows - 1; r >= 0; r--) {
                const idx = r * cols + c;
                if (grid[idx] !== undefined) {
                    const destIdx = writeRow * cols + c;
                    if (writeRow !== r) {
                        grid[destIdx] = grid[idx];
                        grid[idx] = undefined;
                        sourceRow[destIdx] = r;
                        anyFall = true;
                    }
                    writeRow--;
                }
            }
        }

        if (!anyFall) {
            syncCellsFromGrid();
            beginRefilling();
            return;
        }

        syncCellsFromGrid();
        resetTimeline();

        for (let i = 0; i < totalCells; i++) {
            const src = sourceRow[i];
            if (src < 0) continue;
            const r = Math.floor(i / cols);
            cells[i].row = src;
            const fallDist = r - src;
            const dur = fallDist / FALL_SPEED;
            const safeDur = dur || 0.001;
            timeline.to(cells[i], { row: r, duration: safeDur, ease: 'bounce.out' }, 0);
            if (safeDur > maxDur) maxDur = safeDur;
        }

        phaseEndTime = maxDur || 0.001;
    }

    function finishFalling(): void {
        syncCellsFromGrid();
        beginRefilling();
    }

    // ---- Refilling ---------------------------------------------------------

    function beginRefilling(): void {
        boardPhase = 'refilling';
        let maxDur = 0;

        // Count empty cells per column before filling
        const emptyCounts: number[] = [];
        for (let c = 0; c < cols; c++) {
            let count = 0;
            for (let r = 0; r < rows; r++) {
                if (grid[r * cols + c] === undefined) {
                    count++;
                }
                else {
                    break;
                }
            }
            emptyCounts.push(count);
        }

        // Fill empty cells with new random cupcakes
        let anyRefill = false;
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < emptyCounts[c]; r++) {
                grid[r * cols + c] = randomKind();
                anyRefill = true;
            }
        }

        if (!anyRefill) {
            finishRefilling();
            return;
        }

        syncCellsFromGrid();
        resetTimeline();

        // Animate new cupcakes falling from above the board
        for (let c = 0; c < cols; c++) {
            const ec = emptyCounts[c];
            for (let r = 0; r < ec; r++) {
                const cell = cells[r * cols + c];
                cell.row = r - ec; // start above the board
                const fallDist = ec;
                const dur = fallDist / FALL_SPEED;
                const safeDur = dur || 0.001;
                timeline.to(cell, { row: r, duration: safeDur, ease: 'bounce.out' }, 0);
                if (safeDur > maxDur) maxDur = safeDur;
            }
        }

        phaseEndTime = maxDur || 0.001;
    }

    function finishRefilling(): void {
        syncCellsFromGrid();

        // Check for cascade matches
        const matches = findMatches();
        if (matches.length > 0) {
            beginMatching(matches);
        }
        else {
            boardPhase = 'idle';
        }
    }

    // ---- Timeline helpers --------------------------------------------------

    function resetTimeline(): void {
        timeline.kill();
        timeline = gsap.timeline({ paused: true });
        phaseElapsed = 0;
    }

    // ---- Grid helpers ------------------------------------------------------

    function gridAt(r: number, c: number): CupcakeKind | undefined {
        return grid[r * cols + c];
    }

    function randomKind(): CupcakeKind {
        return ALL_CUPCAKE_KINDS[Math.floor(Math.random() * ALL_CUPCAKE_KINDS.length)];
    }

    function fillGridNoMatches(): void {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let kind: CupcakeKind;
                do {
                    kind = randomKind();
                } while (wouldMatch(r, c, kind));
                grid[r * cols + c] = kind;
            }
        }
    }

    function wouldMatch(r: number, c: number, kind: CupcakeKind): boolean {
        // Check horizontal: two to the left
        if (c >= 2 && gridAt(r, c - 1) === kind && gridAt(r, c - 2) === kind) return true;
        // Check vertical: two above
        if (r >= 2 && gridAt(r - 1, c) === kind && gridAt(r - 2, c) === kind) return true;
        return false;
    }

    /** Find all cells that are part of 3+ matches. Returns flat array of indices. */
    function findMatches(): number[] {
        const matched = new Uint8Array(totalCells);

        // Horizontal
        for (let r = 0; r < rows; r++) {
            let runStart = 0;
            let runKind = gridAt(r, 0);
            for (let c = 1; c <= cols; c++) {
                const kind = c < cols ? gridAt(r, c) : undefined;
                if (kind === runKind && kind !== undefined) continue;

                const runLen = c - runStart;
                if (runLen >= 3 && runKind !== undefined) {
                    for (let k = runStart; k < c; k++) {
                        matched[r * cols + k] = 1;
                    }
                }
                runStart = c;
                runKind = kind;
            }
        }

        // Vertical
        for (let c = 0; c < cols; c++) {
            let runStart = 0;
            let runKind = gridAt(0, c);
            for (let r = 1; r <= rows; r++) {
                const kind = r < rows ? gridAt(r, c) : undefined;
                if (kind === runKind && kind !== undefined) continue;

                const runLen = r - runStart;
                if (runLen >= 3 && runKind !== undefined) {
                    for (let k = runStart; k < r; k++) {
                        matched[k * cols + c] = 1;
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

    function syncCellsFromGrid(): void {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                const kind = grid[idx];
                const cell = cells[idx];
                cell.kind = kind ?? 'strawberry';
                cell.row = r;
                cell.col = c;
                cell.alpha = kind !== undefined ? 1 : 0;
                cell.isSelected = false;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableCell {
    kind: CupcakeKind;
    row: number;
    col: number;
    alpha: number;
    isSelected: boolean;
}
