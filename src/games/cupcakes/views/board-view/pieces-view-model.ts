import gsap, { Bounce, Power1 } from 'gsap';
import type { Sequence, DeepReadonly } from '#common';
import { EMPTY_CELL, type BoardPhase, type CupcakeCell } from '../../models';
import { GRID_ROWS, GRID_COLS } from '../../data';
import { CELL_SIZE_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PiecesViewModel {
    getCellX(cell: CupcakeCell): number;
    getCellY(cell: CupcakeCell): number;
    getCellAlpha(cell: CupcakeCell): number;
    /** The cell whose sprite should render on top, or undefined if none. */
    readonly dragOriginCell: CupcakeCell | undefined;
    startDrag(localX: number, localY: number): void;
    dragTo(localX: number, localY: number): void;
    endDrag(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PiecesViewModelOptions {
    getPhase(): BoardPhase;
    getCells(): DeepReadonly<CupcakeCell[][]>;
    getSwapCell1(): CupcakeCell | undefined;
    getSwapCell2(): CupcakeCell | undefined;
    getSwapProgress(): number;
    getSettleProgress(): number;
    getSettleOriginRows(): DeepReadonly<number[][]>;
    getMatchedCells(): readonly CupcakeCell[];
    getMatchSequence(): Sequence<'fade'>;
    onSwapRequested(origin: CupcakeCell, target: CupcakeCell): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPiecesViewModel(options: PiecesViewModelOptions): PiecesViewModel {
    // Track previous candidate for drag transition detection
    let prevCandidateCell: CupcakeCell | undefined;

    // Cached per-frame settle data
    let settleMaxDist = 0;

    // Drag presentation state
    let isCommittedSwap = false;
    let swapOriginCell: CupcakeCell | undefined;
    let swapTargetCell: CupcakeCell | undefined;
    const candidateVisual = { x: 0, y: 0 };
    const returningVisual = { x: 0, y: 0 };
    let candidateCell: CupcakeCell | undefined;
    let returningCell: CupcakeCell | undefined;
    const dragTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    // Drag gesture state
    let isDragActive = false;
    let dragOriginCell: CupcakeCell | undefined;
    let dragTargetCell: CupcakeCell | undefined;
    const dragPointer = { x: 0, y: 0 };

    return {
        getCellX,
        getCellY,
        getCellAlpha,
        get dragOriginCell() { return getDragOriginCell(); },
        startDrag,
        dragTo,
        endDrag,
        update,
    };

    function update(deltaMs: number): void {
        // Advance drag tweens
        if (deltaMs > 0) dragTimeline.time(dragTimeline.time() + deltaMs * 0.001);

        // Cache settle data
        if (options.getPhase() === 'settling') {
            settleMaxDist = computeSettleMaxDist();
        }

        // Update drag presentation (candidate tracking, committed swap clearing)
        updateDragPresentation();
    }

    function getDragOriginCell(): CupcakeCell | undefined {
        if (isCommittedSwap) return swapOriginCell;
        if (isDragActive) return dragOriginCell;
        return undefined;
    }

    // ---- Per-cell accessors ------------------------------------------------

    function getCellX(cell: CupcakeCell): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            if (cell === swapOriginCell) return gridX(swapTargetCell!.col);
            if (cell === candidateCell) return gridX(swapOriginCell!.col);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (isDragActive) {
            if (cell === dragOriginCell) return dragPointer.x;
            if (cell === candidateCell) return candidateVisual.x;
        }

        // Returning cell tween
        if (cell === returningCell) return returningVisual.x;

        // Model swap/reverse interpolation
        const phase = options.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const c1 = options.getSwapCell1();
            const c2 = options.getSwapCell2();
            if (cell === c1 || cell === c2) {
                const t = Power1.easeInOut(options.getSwapProgress());
                const from = cell === c1 ? c1!.col : c2!.col;
                const to = cell === c1 ? c2!.col : c1!.col;
                if (phase === 'reversing') {
                    return gridX(to + (from - to) * t);
                }
                return gridX(from + (to - from) * t);
            }
        }

        // Default: grid position
        return gridX(cell.col);
    }

    function getCellY(cell: CupcakeCell): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            if (cell === swapOriginCell) return gridY(swapTargetCell!.row);
            if (cell === candidateCell) return gridY(swapOriginCell!.row);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (isDragActive) {
            if (cell === dragOriginCell) return dragPointer.y;
            if (cell === candidateCell) return candidateVisual.y;
        }

        // Returning cell tween
        if (cell === returningCell) return returningVisual.y;

        // Model swap/reverse interpolation
        const phase = options.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const c1 = options.getSwapCell1();
            const c2 = options.getSwapCell2();
            if (cell === c1 || cell === c2) {
                const t = Power1.easeInOut(options.getSwapProgress());
                const from = cell === c1 ? c1!.row : c2!.row;
                const to = cell === c1 ? c2!.row : c1!.row;
                if (phase === 'reversing') {
                    return gridY(to + (from - to) * t);
                }
                return gridY(from + (to - from) * t);
            }
        }

        // Settling interpolation
        if (phase === 'settling' && cell !== EMPTY_CELL) {
            const originRow = options.getSettleOriginRows()[cell.row][cell.col];
            if (originRow === originRow) { // not NaN
                const targetRow = cell.row;
                const dist = targetRow - originRow;
                const cellProgress = settleMaxDist > 0
                    ? Math.min(1, options.getSettleProgress() * settleMaxDist / dist)
                    : 1;
                return gridY(originRow + dist * Bounce.easeOut(cellProgress));
            }
        }

        // Default: grid position
        return gridY(cell.row);
    }

    function getCellAlpha(cell: CupcakeCell): number {
        if (cell === EMPTY_CELL) return 0;
        if (options.getMatchedCells().indexOf(cell) === -1) return 1;
        const matchSequence = options.getMatchSequence();
        return matchSequence.isActive ? 1 - matchSequence.steps.fade.progress : 0;
    }

    // ---- Input handlers ----------------------------------------------------

    function startDrag(localX: number, localY: number): void {
        if (options.getPhase() !== 'idle') return;
        const cell = resolveGridCell(localX, localY);
        if (!cell) return;
        isDragActive = true;
        dragOriginCell = cell;
        dragTargetCell = undefined;
        dragPointer.x = localX;
        dragPointer.y = localY;
    }

    function dragTo(localX: number, localY: number): void {
        if (!isDragActive) return;
        dragPointer.x = localX;
        dragPointer.y = localY;
        dragTargetCell = resolveGridCell(localX, localY);
    }

    function endDrag(): void {
        if (!isDragActive) return;
        if (dragTargetCell && options.onSwapRequested(dragOriginCell!, dragTargetCell)) {
            isCommittedSwap = true;
            swapOriginCell = dragOriginCell;
            swapTargetCell = dragTargetCell;
        }
        isDragActive = false;
        dragTargetCell = undefined;
    }

    // ---- Drag presentation helpers -----------------------------------------

    function computeSettleMaxDist(): number {
        const settleOriginRows = options.getSettleOriginRows();
        const cells = options.getCells();
        let maxDist = 0;
        for (let r = 0; r < cells.length; r++) {
            for (let c = 0; c < cells[r].length; c++) {
                const originRow = settleOriginRows[r][c];
                if (originRow !== originRow) continue; // NaN check
                const dist = cells[r][c].row - originRow;
                if (dist > maxDist) maxDist = dist;
            }
        }
        return maxDist;
    }

    function updateDragPresentation(): void {
        // Committed swap override: hold cells at swapped positions during 'swapping'
        if (isCommittedSwap) {
            if (options.getPhase() !== 'swapping') {
                clearCommittedSwap();
                prevCandidateCell = undefined;
            }
            return;
        }

        const newCandidateCell = isDragActive && dragTargetCell
            ? dragTargetCell
            : undefined;

        if (newCandidateCell !== prevCandidateCell) {
            // Previous candidate starts returning to grid
            if (prevCandidateCell && options.getPhase() === 'idle') {
                returningCell = prevCandidateCell;
                const targetX = gridX(prevCandidateCell.col);
                const targetY = gridY(prevCandidateCell.row);
                slideReturn(
                    candidateVisual.x,
                    candidateVisual.y,
                    targetX,
                    targetY,
                );
            }

            // New candidate starts sliding toward origin
            if (newCandidateCell) {
                const fromX = gridX(newCandidateCell.col);
                const fromY = gridY(newCandidateCell.row);
                const targetX = gridX(dragOriginCell!.col);
                const targetY = gridY(dragOriginCell!.row);
                slideCandidate(fromX, fromY, targetX, targetY);
            }

            prevCandidateCell = newCandidateCell;
        }

        candidateCell = newCandidateCell;
    }

    function clearCommittedSwap(): void {
        isCommittedSwap = false;
        swapOriginCell = undefined;
        swapTargetCell = undefined;
        candidateCell = undefined;
        returningCell = undefined;
    }

    function resolveGridCell(x: number, y: number): CupcakeCell | undefined {
        const col = Math.floor(x / CELL_SIZE_PX);
        const row = Math.floor(y / CELL_SIZE_PX);
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return undefined;
        const cell = options.getCells()[row][col];
        if (isDragActive) {
            if (cell === dragOriginCell) return undefined;
            const dr = Math.abs(row - dragOriginCell!.row);
            const dc = Math.abs(col - dragOriginCell!.col);
            if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return undefined;
        }
        return cell;
    }

    function slideCandidate(fromX: number, fromY: number, toX: number, toY: number): void {
        candidateVisual.x = fromX;
        candidateVisual.y = fromY;
        const t = dragTimeline.time();
        dragTimeline.to(candidateVisual, { x: toX, y: toY, duration: CANDIDATE_SLIDE_DURATION, ease: 'power2.out' }, t);
    }

    function slideReturn(fromX: number, fromY: number, toX: number, toY: number): void {
        returningVisual.x = fromX;
        returningVisual.y = fromY;
        const t = dragTimeline.time();
        dragTimeline.to(returningVisual, {
            x: toX,
            y: toY,
            duration: RETURN_SLIDE_DURATION,
            ease: 'power2.out',
            onComplete: () => { returningCell = undefined; },
        }, t);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Slide duration in seconds for the candidate cell animation. */
const CANDIDATE_SLIDE_DURATION = 0.12;
/** Slide duration in seconds for the returning cell animation. */
const RETURN_SLIDE_DURATION = 0.15;

function gridX(col: number): number {
    return col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}
