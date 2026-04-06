import { Container, Graphics } from 'pixi.js';
import gsap, { Bounce, Power1 } from 'gsap';
import { createSequenceReaction, watch, type Sequence, type StatefulPixiView } from '#common';
import type { BoardPhase, CupcakeCell } from '../../models';
import { GRID_ROWS, GRID_COLS } from '../../data';
import { CELL_SIZE_PX } from '../view-constants';
import { createCupcakeView } from '../cupcake-view';
import { createGridDragGesture } from '../grid-drag-gesture';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardPiecesViewBindings {
    getPhase(): BoardPhase;
    getCells(): readonly Readonly<CupcakeCell>[];
    getSwapPos1(): { col: number; row: number };
    getSwapPos2(): { col: number; row: number };
    getSwapProgress(): number;
    getSettleOrigins(): readonly number[];
    getSettleProgress(): number;
    getMatchedIndices(): readonly number[];
    getCascadeStep(): number;
    getMatchSequence(): Sequence<'fade' | 'shake'>;
    onSwapRequested(origin: { col: number; row: number }, target: { col: number; row: number }): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardPiecesView(bindings: BoardPiecesViewBindings): StatefulPixiView {
    const view = new Container();
    const watcher = watch({ cellCount: () => bindings.getCells().length });
    let cupcakeContainers: Container[] = [];

    // boardContent is offset by the shake displacement each frame.
    // It contains both the checkerboard background and the cupcakes so the
    // whole board visual shakes together as a unit.
    const boardContent = new Container();
    boardContent.sortableChildren = true;
    view.addChild(boardContent);

    // Match sequence reactions for shake
    const updateMatchReactions = createSequenceReaction(bindings.getMatchSequence(), {
        shake: {
            inactive: () => boardContent.position.set(0, 0),
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                const amp = (SHAKE_AMPLITUDE + SHAKE_CASCADE_BONUS * (cascade - 1)) * (1 - progress);
                const p = progress * SHAKE_FREQUENCY;
                boardContent.position.set(
                    Math.sin(p) * amp,
                    Math.cos(p * 0.7) * amp * 0.6,
                );
            },
        },
    });

    // Track previous candidate for drag transition detection
    let prevCandidateIdx = -1;

    // Cached per-frame settle data
    let settleMaxDist = 0;

    // Drag presentation state
    let isCommittedSwap = false;
    const swapOrigin = { col: -1, row: -1 };
    const swapTarget = { col: -1, row: -1 };
    const candidateVisual = { x: 0, y: 0 };
    const returningVisual = { x: 0, y: 0 };
    let candidateIdx = -1;
    let returningIdx = -1;
    const dragTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    // Drag gesture
    const gesture = createGridDragGesture({
        toGridPosition: (x, y) => {
            const col = Math.floor(x / CELL_SIZE_PX);
            const row = Math.floor(y / CELL_SIZE_PX);
            if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return undefined;
            if (gesture.isActive) {
                if (row === gesture.origin.row && col === gesture.origin.col) return undefined;
                const dr = Math.abs(row - gesture.origin.row);
                const dc = Math.abs(col - gesture.origin.col);
                if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return undefined;
            }
            return { col, row };
        },
    });

    // Input listeners
    view.eventMode = 'static';
    view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < GRID_COLS * CELL_SIZE_PX && y >= 0 && y < GRID_ROWS * CELL_SIZE_PX };
    view.on('pointerdown', onPointerDown);
    view.on('globalpointermove', onPointerMove);
    view.on('pointerup', onPointerUp);
    view.on('pointerupoutside', onPointerUp);

    initialiseContent();
    view.onRender = refresh;

    return Object.assign(view, { update });

    function update(deltaMs: number): void {
        if (deltaMs > 0) dragTimeline.time(dragTimeline.time() + deltaMs * 0.001);
    }

    function initialiseContent(): void {
        const bg = new Graphics();
        bg.zIndex = -1;
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const shade = (r + c) % 2 === 0 ? 0x3A2A4A : 0x2E1E3E;
                bg.rect(c * CELL_SIZE_PX, r * CELL_SIZE_PX, CELL_SIZE_PX, CELL_SIZE_PX).fill(shade);
            }
        }
        boardContent.addChild(bg);
        buildCupcakes();
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.cellCount.changed) {
            buildCupcakes();
        }

        if (bindings.getPhase() === 'settling') {
            settleMaxDist = computeSettleMaxDist();
        }

        updateMatchReactions();
        updateDragPresentation();
    }

    function computeSettleMaxDist(): number {
        const origins = bindings.getSettleOrigins();
        const cells = bindings.getCells();
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
            if (bindings.getPhase() !== 'swapping') {
                clearCommittedSwap();
                prevCandidateIdx = -1;
            }
            return;
        }

        const newCandidateIdx = gesture.isActive && gesture.target.row >= 0
            ? gesture.target.row * GRID_COLS + gesture.target.col
            : -1;

        if (newCandidateIdx !== prevCandidateIdx) {
            // Previous candidate starts returning to grid
            if (prevCandidateIdx >= 0 && bindings.getPhase() === 'idle') {
                returningIdx = prevCandidateIdx;

                const cell = bindings.getCells()[prevCandidateIdx];
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
            if (newCandidateIdx >= 0) {
                const cell = bindings.getCells()[newCandidateIdx];
                const fromX = gridX(cell.pos.col);
                const fromY = gridY(cell.pos.row);
                const targetX = gridX(gesture.origin.col);
                const targetY = gridY(gesture.origin.row);
                slideCandidate(fromX, fromY, targetX, targetY);
            }

            prevCandidateIdx = newCandidateIdx;
        }

        candidateIdx = newCandidateIdx;
    }

    function buildCupcakes(): void {
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].destroy({ children: true });
        }
        cupcakeContainers = [];

        const count = bindings.getCells().length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createCupcakeView({
                getKind: () => bindings.getCells()[idx].kind,
                getX: () => getCellX(idx),
                getY: () => getCellY(idx),
                getAlpha: () => getCellAlpha(idx),
            });
            boardContent.addChild(c);
            cupcakeContainers.push(c);
        }
    }

    function getCellX(idx: number): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            const swapOriginIdx = swapOrigin.row * GRID_COLS + swapOrigin.col;
            if (idx === swapOriginIdx) return gridX(swapTarget.col);
            if (idx === candidateIdx) return gridX(swapOrigin.col);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (gesture.isActive) {
            const dragOriginIdx = gesture.origin.row * GRID_COLS + gesture.origin.col;
            if (idx === dragOriginIdx) return gesture.pointer.x;
            if (idx === candidateIdx) return candidateVisual.x;
        }

        // Returning cell tween
        if (idx === returningIdx) return returningVisual.x;

        // Model swap/reverse interpolation
        const phase = bindings.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const p1 = bindings.getSwapPos1();
            const p2 = bindings.getSwapPos2();
            const idx1 = p1.row * GRID_COLS + p1.col;
            const idx2 = p2.row * GRID_COLS + p2.col;
            if (idx === idx1 || idx === idx2) {
                const t = Power1.easeInOut(bindings.getSwapProgress());
                const from = idx === idx1 ? p1.col : p2.col;
                const to = idx === idx1 ? p2.col : p1.col;
                if (phase === 'reversing') {
                    return gridX(to + (from - to) * t);
                }
                return gridX(from + (to - from) * t);
            }
        }

        // Default: grid position
        return gridX(bindings.getCells()[idx].pos.col);
    }

    function getCellY(idx: number): number {
        // Committed swap: hold cells at swapped visual positions
        if (isCommittedSwap) {
            const swapOriginIdx = swapOrigin.row * GRID_COLS + swapOrigin.col;
            if (idx === swapOriginIdx) return gridY(swapTarget.row);
            if (idx === candidateIdx) return gridY(swapOrigin.row);
        }

        // Active drag: origin follows pointer, candidate follows tween
        if (gesture.isActive) {
            const dragOriginIdx = gesture.origin.row * GRID_COLS + gesture.origin.col;
            if (idx === dragOriginIdx) return gesture.pointer.y;
            if (idx === candidateIdx) return candidateVisual.y;
        }

        // Returning cell tween
        if (idx === returningIdx) return returningVisual.y;

        // Model swap/reverse interpolation
        const phase = bindings.getPhase();
        if (phase === 'swapping' || phase === 'reversing') {
            const p1 = bindings.getSwapPos1();
            const p2 = bindings.getSwapPos2();
            const idx1 = p1.row * GRID_COLS + p1.col;
            const idx2 = p2.row * GRID_COLS + p2.col;
            if (idx === idx1 || idx === idx2) {
                const t = Power1.easeInOut(bindings.getSwapProgress());
                const from = idx === idx1 ? p1.row : p2.row;
                const to = idx === idx1 ? p2.row : p1.row;
                if (phase === 'reversing') {
                    return gridY(to + (from - to) * t);
                }
                return gridY(from + (to - from) * t);
            }
        }

        // Settling interpolation
        if (phase === 'settling') {
            const origin = bindings.getSettleOrigins()[idx];
            if (origin === origin) { // not NaN
                const targetRow = bindings.getCells()[idx].pos.row;
                const dist = targetRow - origin;
                const cellProgress = settleMaxDist > 0
                    ? Math.min(1, bindings.getSettleProgress() * settleMaxDist / dist)
                    : 1;
                return gridY(origin + dist * Bounce.easeOut(cellProgress));
            }
        }

        // Default: grid position
        return gridY(bindings.getCells()[idx].pos.row);
    }

    function getCellAlpha(idx: number): number {
        const cell = bindings.getCells()[idx];
        if (!cell.isAlive) return 0;
        if (bindings.getMatchedIndices().indexOf(idx) === -1) return 1;
        const matchSequence = bindings.getMatchSequence();
        return matchSequence.isActive ? 1 - matchSequence.steps.fade.progress : 1;
    }

    // ---- Input handlers ----------------------------------------------------

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        if (bindings.getPhase() !== 'idle') return;
        const local = view.toLocal(e.global);
        gesture.begin(local.x, local.y);
        if (gesture.isActive) {
            const idx = gesture.origin.row * GRID_COLS + gesture.origin.col;
            cupcakeContainers[idx].zIndex = DRAG_Z_INDEX;
        }
    }

    function onPointerMove(e: { global: { x: number; y: number } }): void {
        if (!gesture.isActive) return;
        const local = view.toLocal(e.global);
        gesture.move(local.x, local.y);
    }

    function onPointerUp(): void {
        if (!gesture.isActive) return;
        const originIdx = gesture.origin.row * GRID_COLS + gesture.origin.col;
        if (gesture.target.row >= 0 && bindings.onSwapRequested(gesture.origin, gesture.target)) {
            isCommittedSwap = true;
            swapOrigin.row = gesture.origin.row;
            swapOrigin.col = gesture.origin.col;
            swapTarget.row = gesture.target.row;
            swapTarget.col = gesture.target.col;
        }
        else {
            cupcakeContainers[originIdx].zIndex = 0;
        }
        gesture.end();
    }

    // ---- Drag helpers -------------------------------------------------------

    function clearCommittedSwap(): void {
        const originIdx = swapOrigin.row * GRID_COLS + swapOrigin.col;
        if (originIdx >= 0 && originIdx < cupcakeContainers.length) {
            cupcakeContainers[originIdx].zIndex = 0;
        }
        isCommittedSwap = false;
        swapOrigin.row = -1;
        swapOrigin.col = -1;
        swapTarget.row = -1;
        swapTarget.col = -1;
        candidateIdx = -1;
        returningIdx = -1;
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
            onComplete: () => { returningIdx = -1; },
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

/** zIndex applied to the dragged cupcake so it renders above its neighbours. */
const DRAG_Z_INDEX = 10;

/** Maximum shake offset in pixels at cascade step 1. */
const SHAKE_AMPLITUDE = 3;
/** Extra shake amplitude per additional cascade step. */
const SHAKE_CASCADE_BONUS = 1.5;
/** Speed multiplier for the shake oscillation. */
const SHAKE_FREQUENCY = 40;

function gridX(col: number): number {
    return col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}
