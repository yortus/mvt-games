import gsap, { Bounce, Power1 } from 'gsap';
import type { Sequence } from '#common';
import type { BoardPhase, CupcakeCell } from '../../models';
import { GRID_ROWS, GRID_COLS } from '../../data';
import { CELL_SIZE_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PiecesViewModel {
    getCellX(index: number): number;
    getCellY(index: number): number;
    getCellAlpha(index: number): number;
    /** Index of the cell whose sprite should render on top, or -1 if none. */
    readonly dragOriginIndex: number;
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
    getCells(): readonly Readonly<CupcakeCell>[];
    getSwapPos1(): { col: number; row: number };
    getSwapPos2(): { col: number; row: number };
    getSwapProgress(): number;
    getSettleOrigins(): readonly number[];
    getSettleProgress(): number;
    getMatchedIndices(): readonly number[];
    getMatchSequence(): Sequence<'fade'>;
    onSwapRequested(origin: { col: number; row: number }, target: { col: number; row: number }): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPiecesViewModel(options: PiecesViewModelOptions): PiecesViewModel {
    // Track previous candidate for drag transition detection
    let prevCandidateIndex = -1;

    // Cached per-frame settle data
    let settleMaxDist = 0;

    // Drag presentation state
    let isCommittedSwap = false;
    let swapOrigin = { col: -1, row: -1 };
    let swapTarget = { col: -1, row: -1 };
    const candidateVisual = { x: 0, y: 0 };
    const returningVisual = { x: 0, y: 0 };
    let candidateIndex = -1;
    let returningIndex = -1;
    const dragTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    // Drag gesture state
    let isDragActive = false;
    const dragOrigin = { col: -1, row: -1 };
    const dragTarget = { col: -1, row: -1 };
    const dragPointer = { x: 0, y: 0 };

    return {
        getCellX,
        getCellY,
        getCellAlpha,
        get dragOriginIndex() { return getDragOriginIndex(); },
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

    function getDragOriginIndex(): number {
        if (isCommittedSwap) return swapOrigin.row * GRID_COLS + swapOrigin.col;
        if (isDragActive) return dragOrigin.row * GRID_COLS + dragOrigin.col;
        return -1;
    }

    // ---- Per-cell accessors ------------------------------------------------

    function getCellX(index: number): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            const swapOriginIndex = swapOrigin.row * GRID_COLS + swapOrigin.col;
            if (index === swapOriginIndex) return gridX(swapTarget.col);
            if (index === candidateIndex) return gridX(swapOrigin.col);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (isDragActive) {
            const originIndex = dragOrigin.row * GRID_COLS + dragOrigin.col;
            if (index === originIndex) return dragPointer.x;
            if (index === candidateIndex) return candidateVisual.x;
        }

        // Returning cell tween
        if (index === returningIndex) return returningVisual.x;

        // Model swap/reverse interpolation
        const phase = options.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const p1 = options.getSwapPos1();
            const p2 = options.getSwapPos2();
            const i1 = p1.row * GRID_COLS + p1.col;
            const i2 = p2.row * GRID_COLS + p2.col;
            if (index === i1 || index === i2) {
                const t = Power1.easeInOut(options.getSwapProgress());
                const from = index === i1 ? p1.col : p2.col;
                const to = index === i1 ? p2.col : p1.col;
                if (phase === 'reversing') {
                    return gridX(to + (from - to) * t);
                }
                return gridX(from + (to - from) * t);
            }
        }

        // Default: grid position
        return gridX(options.getCells()[index].pos.col);
    }

    function getCellY(index: number): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            const swapOriginIndex = swapOrigin.row * GRID_COLS + swapOrigin.col;
            if (index === swapOriginIndex) return gridY(swapTarget.row);
            if (index === candidateIndex) return gridY(swapOrigin.row);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (isDragActive) {
            const originIndex = dragOrigin.row * GRID_COLS + dragOrigin.col;
            if (index === originIndex) return dragPointer.y;
            if (index === candidateIndex) return candidateVisual.y;
        }

        // Returning cell tween
        if (index === returningIndex) return returningVisual.y;

        // Model swap/reverse interpolation
        const phase = options.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const p1 = options.getSwapPos1();
            const p2 = options.getSwapPos2();
            const i1 = p1.row * GRID_COLS + p1.col;
            const i2 = p2.row * GRID_COLS + p2.col;
            if (index === i1 || index === i2) {
                const t = Power1.easeInOut(options.getSwapProgress());
                const from = index === i1 ? p1.row : p2.row;
                const to = index === i1 ? p2.row : p1.row;
                if (phase === 'reversing') {
                    return gridY(to + (from - to) * t);
                }
                return gridY(from + (to - from) * t);
            }
        }

        // Settling interpolation
        if (phase === 'settling') {
            const origin = options.getSettleOrigins()[index];
            if (origin === origin) { // not NaN
                const targetRow = options.getCells()[index].pos.row;
                const dist = targetRow - origin;
                const cellProgress = settleMaxDist > 0
                    ? Math.min(1, options.getSettleProgress() * settleMaxDist / dist)
                    : 1;
                return gridY(origin + dist * Bounce.easeOut(cellProgress));
            }
        }

        // Default: grid position
        return gridY(options.getCells()[index].pos.row);
    }

    function getCellAlpha(index: number): number {
        const cell = options.getCells()[index];
        if (!cell.isAlive) return 0;
        if (options.getMatchedIndices().indexOf(index) === -1) return 1;
        const matchSequence = options.getMatchSequence();
        return matchSequence.isActive ? 1 - matchSequence.steps.fade.progress : 0;
    }

    // ---- Input handlers ----------------------------------------------------

    function startDrag(localX: number, localY: number): void {
        if (options.getPhase() !== 'idle') return;
        const pos = resolveGridPosition(localX, localY);
        if (pos === undefined) return;
        isDragActive = true;
        dragOrigin.row = pos.row;
        dragOrigin.col = pos.col;
        dragTarget.row = -1;
        dragTarget.col = -1;
        dragPointer.x = localX;
        dragPointer.y = localY;
    }

    function dragTo(localX: number, localY: number): void {
        if (!isDragActive) return;
        dragPointer.x = localX;
        dragPointer.y = localY;
        const pos = resolveGridPosition(localX, localY);
        dragTarget.row = pos ? pos.row : -1;
        dragTarget.col = pos ? pos.col : -1;
    }

    function endDrag(): void {
        if (!isDragActive) return;
        if (dragTarget.row >= 0 && options.onSwapRequested(dragOrigin, dragTarget)) {
            isCommittedSwap = true;
            swapOrigin = { ...dragOrigin };
            swapTarget = { ...dragTarget };
        }
        isDragActive = false;
        dragTarget.row = -1;
        dragTarget.col = -1;
    }

    // ---- Drag presentation helpers -----------------------------------------

    function computeSettleMaxDist(): number {
        const origins = options.getSettleOrigins();
        const cells = options.getCells();
        let maxDist = 0;
        for (let i = 0; i < origins.length; i++) {
            if (origins[i] !== origins[i]) continue;
            const dist = cells[i].pos.row - origins[i];
            if (dist > maxDist) maxDist = dist;
        }
        return maxDist;
    }

    function updateDragPresentation(): void {
        // Committed swap override: hold cells at swapped positions during 'swapping'
        if (isCommittedSwap) {
            if (options.getPhase() !== 'swapping') {
                clearCommittedSwap();
                prevCandidateIndex = -1;
            }
            return;
        }

        const newCandidateIndex = isDragActive && dragTarget.row >= 0
            ? dragTarget.row * GRID_COLS + dragTarget.col
            : -1;

        if (newCandidateIndex !== prevCandidateIndex) {
            // Previous candidate starts returning to grid
            if (prevCandidateIndex >= 0 && options.getPhase() === 'idle') {
                returningIndex = prevCandidateIndex;

                const cell = options.getCells()[prevCandidateIndex];
                const targetX = gridX(cell.pos.col);
                const targetY = gridY(cell.pos.row);
                slideReturn(
                    candidateVisual.x,
                    candidateVisual.y,
                    targetX,
                    targetY,
                );
            }

            // New candidate starts sliding toward origin
            if (newCandidateIndex >= 0) {
                const cell = options.getCells()[newCandidateIndex];
                const fromX = gridX(cell.pos.col);
                const fromY = gridY(cell.pos.row);
                const targetX = gridX(dragOrigin.col);
                const targetY = gridY(dragOrigin.row);
                slideCandidate(fromX, fromY, targetX, targetY);
            }

            prevCandidateIndex = newCandidateIndex;
        }

        candidateIndex = newCandidateIndex;
    }

    function clearCommittedSwap(): void {
        isCommittedSwap = false;
        swapOrigin.row = -1;
        swapOrigin.col = -1;
        swapTarget.row = -1;
        swapTarget.col = -1;
        candidateIndex = -1;
        returningIndex = -1;
    }

    function resolveGridPosition(x: number, y: number): { col: number; row: number } | undefined {
        const col = Math.floor(x / CELL_SIZE_PX);
        const row = Math.floor(y / CELL_SIZE_PX);
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return undefined;
        if (isDragActive) {
            if (row === dragOrigin.row && col === dragOrigin.col) return undefined;
            const dr = Math.abs(row - dragOrigin.row);
            const dc = Math.abs(col - dragOrigin.col);
            if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return undefined;
        }
        return { col, row };
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
            onComplete: () => { returningIndex = -1; },
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
