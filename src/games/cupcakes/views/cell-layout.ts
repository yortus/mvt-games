import { Bounce, Power1 } from 'gsap';
import type { BoardPhase } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CellLayout {
    readonly x: number;
    readonly y: number;
    readonly alpha: number;
    readonly zIndex: number;
}

/** Snapshot of board state needed for layout computation. */
export interface BoardSnapshot {
    colCount: number;
    phase: BoardPhase;
    cellPos: { col: number; row: number };
    cellIsAlive: boolean;
    swapPos1: { col: number; row: number };
    swapPos2: { col: number; row: number };
    swapProgress: number;
    settleOrigin: number;
    settleProgress: number;
    settleMaxDist: number;
    matchProgress: number;
    isMatched: boolean;
}

/** Snapshot of drag presentation state needed for layout. */
export interface DragSnapshot {
    active: boolean;
    committedSwap: boolean;
    originIdx: number;
    candidateIdx: number;
    pointer: { x: number; y: number };
    origin: { col: number; row: number };
    candidate: { col: number; row: number };
    candidateVisual: { x: number; y: number };
    returningIdx: number;
    returningVisual: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// Pre-allocated result object to avoid per-call allocation
const result: { x: number; y: number; alpha: number; zIndex: number } = { x: 0, y: 0, alpha: 0, zIndex: 0 };

/** Compute the visual x, y, alpha, and zIndex for a single cell. */
export function computeCellLayout(
    idx: number,
    cellSize: number,
    board: BoardSnapshot,
    drag: DragSnapshot,
): CellLayout {
    result.x = computeX(idx, cellSize, board, drag);
    result.y = computeY(idx, cellSize, board, drag);
    result.alpha = computeAlpha(board);
    result.zIndex = (drag.active && idx === drag.originIdx) ? 100 : 0;
    return result;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function gridX(col: number, cellSize: number): number {
    return col * cellSize + cellSize * 0.5;
}

function gridY(row: number, cellSize: number): number {
    return row * cellSize + cellSize * 0.5;
}

function computeX(idx: number, cellSize: number, board: BoardSnapshot, drag: DragSnapshot): number {
    // 1. Committed swap: hold cells at swapped visual positions
    if (drag.committedSwap) {
        if (idx === drag.originIdx) return gridX(drag.candidate.col, cellSize);
        if (idx === drag.candidateIdx) return gridX(drag.origin.col, cellSize);
    }

    // 2. Active drag: origin follows pointer
    if (drag.active && idx === drag.originIdx) return drag.pointer.x;

    // 3. Active drag: candidate is being tweened
    if (drag.active && idx === drag.candidateIdx) return drag.candidateVisual.x;

    // 4. Returning cell tween
    if (idx === drag.returningIdx) return drag.returningVisual.x;

    // 5. Model swap/reverse interpolation
    if (board.phase === 'swapping' || board.phase === 'reversing') {
        const p1 = board.swapPos1;
        const p2 = board.swapPos2;
        const idx1 = p1.row * board.colCount + p1.col;
        const idx2 = p2.row * board.colCount + p2.col;
        if (idx === idx1 || idx === idx2) {
            const t = Power1.easeInOut(board.swapProgress);
            const from = idx === idx1 ? p1.col : p2.col;
            const to = idx === idx1 ? p2.col : p1.col;
            if (board.phase === 'reversing') {
                return gridX(to + (from - to) * t, cellSize);
            }
            return gridX(from + (to - from) * t, cellSize);
        }
    }

    // 6. Default: grid position
    return gridX(board.cellPos.col, cellSize);
}

function computeY(idx: number, cellSize: number, board: BoardSnapshot, drag: DragSnapshot): number {
    // 1. Committed swap: hold cells at swapped visual positions
    if (drag.committedSwap) {
        if (idx === drag.originIdx) return gridY(drag.candidate.row, cellSize);
        if (idx === drag.candidateIdx) return gridY(drag.origin.row, cellSize);
    }

    // 2. Active drag: origin follows pointer
    if (drag.active && idx === drag.originIdx) return drag.pointer.y;

    // 3. Active drag: candidate is being tweened
    if (drag.active && idx === drag.candidateIdx) return drag.candidateVisual.y;

    // 4. Returning cell tween
    if (idx === drag.returningIdx) return drag.returningVisual.y;

    // 5. Model swap/reverse interpolation
    if (board.phase === 'swapping' || board.phase === 'reversing') {
        const p1 = board.swapPos1;
        const p2 = board.swapPos2;
        const idx1 = p1.row * board.colCount + p1.col;
        const idx2 = p2.row * board.colCount + p2.col;
        if (idx === idx1 || idx === idx2) {
            const t = Power1.easeInOut(board.swapProgress);
            const from = idx === idx1 ? p1.row : p2.row;
            const to = idx === idx1 ? p2.row : p1.row;
            if (board.phase === 'reversing') {
                return gridY(to + (from - to) * t, cellSize);
            }
            return gridY(from + (to - from) * t, cellSize);
        }
    }

    // 6. Settling interpolation
    if (board.phase === 'settling') {
        const origin = board.settleOrigin;
        if (origin === origin) { // not NaN
            const target = board.cellPos.row;
            const dist = target - origin;
            const cellProgress = board.settleMaxDist > 0 ?
                    Math.min(1, board.settleProgress * board.settleMaxDist / dist) :
                1;
            return gridY(origin + dist * Bounce.easeOut(cellProgress), cellSize);
        }
    }

    // 7. Default: grid position
    return gridY(board.cellPos.row, cellSize);
}

function computeAlpha(board: BoardSnapshot): number {
    if (!board.cellIsAlive) return 0;
    if (board.phase === 'matching' && board.isMatched) return 1 - board.matchProgress;
    return 1;
}
