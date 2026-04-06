import { Container, Graphics, Text } from 'pixi.js';
import gsap, { Bounce, Power1 } from 'gsap';
import { createSequence, createSequenceReaction, type StepDef, type StatefulPixiView, watch } from '#common';
import type { BoardPhase, CupcakeCell } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_SIZE_PX } from './view-constants';
import { createCupcakeView } from './cupcake-view';
import { createGridDragGesture } from './grid-drag-gesture';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    getPhase(): BoardPhase;
    getCells(): readonly Readonly<CupcakeCell>[];
    getSwapPos1(): { col: number; row: number };
    getSwapPos2(): { col: number; row: number };
    getSwapProgress(): number;
    getSettleOrigins(): readonly number[];
    getSettleProgress(): number;
    getMatchedIndices(): readonly number[];
    getCascadeStep(): number;
    onSwapRequested(origin: { col: number; row: number }, target: { col: number; row: number }): boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum shake offset in pixels at cascade step 1. */
const SHAKE_AMPLITUDE = 3;
/** Extra shake amplitude per additional cascade step. */
const SHAKE_CASCADE_BONUS = 1.5;
/** Speed multiplier for the shake oscillation. */
const SHAKE_FREQUENCY = 40;

/** Base dust cloud radius in pixels. */
const DUST_RADIUS = 6;
/** Extra dust radius per additional cascade step. */
const DUST_CASCADE_BONUS = 2;
/** Number of pre-allocated dust sprites. */
const DUST_POOL_SIZE = 16;

/** Score popup style. */
const POPUP_FONT_SIZE = 12;
/** How far the popup floats upward in pixels. */
const POPUP_RISE_PX = 20;

/** Slide duration in seconds for the candidate cell animation. */
const CANDIDATE_SLIDE_DURATION = 0.12;
/** Slide duration in seconds for the returning cell animation. */
const RETURN_SLIDE_DURATION = 0.15;

/**
 * Overlapping effect steps that play during a match sequence.
 *
 * ```
 * Time (ms):  0        100       200       250       350       500
 *             |---------|---------|---------|---------|---------|-----|
 *  fade:      [=====================]                              0-250ms
 *  shake:        [=================]                               50-250ms
 *  dust:            [==========================]                   100-350ms
 *  popup:               [================================]         150-500ms
 * ```
 */
const MATCH_EFFECT_STEPS = [
    { name: 'fade',  startMs: 0,   durationMs: 250 },
    { name: 'shake', startMs: 50,  durationMs: 200 },
    { name: 'dust',  startMs: 100, durationMs: 250 },
    { name: 'popup', startMs: 150, durationMs: 350 },
] as const satisfies readonly StepDef[];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardView(bindings: BoardViewBindings): StatefulPixiView {
    const matchEffects = createSequence(MATCH_EFFECT_STEPS);
    const phaseWatcher = watch({ phase: bindings.getPhase });

    const view = new Container();
    view.sortableChildren = true;
    const watcher = watch({ cellCount: () => bindings.getCells().length });
    let cupcakeContainers: Container[] = [];

    // Board content container (offset by shake)
    const boardContent = new Container();
    boardContent.sortableChildren = true;
    view.addChild(boardContent);

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

    // Dust cloud pool (pre-allocated circles)
    const dustPool: Graphics[] = [];
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const g = new Graphics();
        g.circle(0, 0, 1).fill(0xffffff);
        g.alpha = 0;
        g.zIndex = 50;
        view.addChild(g);
        dustPool.push(g);
    }

    // Score popup text
    const popupTextContainer = new Container();
    popupTextContainer.zIndex = 60;
    view.addChild(popupTextContainer);
    const popupText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: POPUP_FONT_SIZE, fill: 0xffff00, fontWeight: 'bold' },
        anchor: { x: 0.5, y: 0.5 },
        alpha: 0,
    });
    popupTextContainer.addChild(popupText);

    // ---- Match effect reactions (dispatched by step lifecycle) ---------------

    const updateMatchEffects = createSequenceReaction(matchEffects, {
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
        dust: {
            inactive: () => {
                for (let i = 0; i < DUST_POOL_SIZE; i++) {
                    dustPool[i].alpha = 0;
                }
            },
            active: (progress) => {
                const matchedIndices = bindings.getMatchedIndices();
                const cascade = bindings.getCascadeStep();
                const cells = bindings.getCells();
                const radius = DUST_RADIUS + DUST_CASCADE_BONUS * (cascade - 1);
                const count = matchedIndices.length < DUST_POOL_SIZE ? matchedIndices.length : DUST_POOL_SIZE;
                const expand = progress;
                const fade = 1 - progress;

                for (let i = 0; i < count; i++) {
                    const cell = cells[matchedIndices[i]];
                    const cx = gridX(cell.pos.col);
                    const cy = gridY(cell.pos.row);
                    const g = dustPool[i];
                    g.position.set(cx, cy);
                    g.scale.set(radius * (0.5 + expand * 0.5));
                    g.alpha = fade * 0.6;
                }
                for (let i = count; i < DUST_POOL_SIZE; i++) {
                    dustPool[i].alpha = 0;
                }
            },
        },
        popup: {
            inactive: () => {
                popupText.alpha = 0;
            },
            entering: () => {
                const centre = computeMatchCentre(bindings.getMatchedIndices());
                popupTextContainer.position.set(centre.x, centre.y);
                const cascade = bindings.getCascadeStep();
                const matchCount = bindings.getMatchedIndices().length;
                const pts = matchCount * 10;
                popupText.text = cascade > 1 ? `+${pts} x${cascade}` : `+${pts}`;
            },
            active: (progress) => {
                popupText.position.set(0, -POPUP_RISE_PX * progress);
                popupText.alpha = 1 - progress ** 2;
            },
        },
    });

    initialiseView();
    view.onRender = refresh;

    function update(deltaMs: number): void {
        const { phase } = phaseWatcher.poll();
        if (phase.changed && phase.value === 'matching') matchEffects.start();
        matchEffects.update(deltaMs);
        if (deltaMs > 0) dragTimeline.time(dragTimeline.time() + deltaMs * 0.001);
    }

    return Object.assign(view, { update });

    function initialiseView(): void {
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

        updateMatchEffects();
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
        if (!matchEffects.isActive) return 1;
        if (bindings.getMatchedIndices().indexOf(idx) === -1) return 1;
        return 1 - matchEffects.steps.fade.progress;
    }

    // ---- Input handlers ----------------------------------------------------

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        if (bindings.getPhase() !== 'idle') return;
        const local = view.toLocal(e.global);
        gesture.begin(local.x, local.y);
    }

    function onPointerMove(e: { global: { x: number; y: number } }): void {
        if (!gesture.isActive) return;
        const local = view.toLocal(e.global);
        gesture.move(local.x, local.y);
    }

    function onPointerUp(): void {
        if (!gesture.isActive) return;
        if (gesture.target.row >= 0 && bindings.onSwapRequested(gesture.origin, gesture.target)) {
            isCommittedSwap = true;
            swapOrigin.row = gesture.origin.row;
            swapOrigin.col = gesture.origin.col;
            swapTarget.row = gesture.target.row;
            swapTarget.col = gesture.target.col;
        }
        gesture.end();
    }

    // ---- Drag helpers -------------------------------------------------------

    function clearCommittedSwap(): void {
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

    // ---- Match effects (helpers) -------------------------------------------

    function computeMatchCentre(indices: readonly number[]): { x: number; y: number } {
        let sumX = 0;
        let sumY = 0;
        const cells = bindings.getCells();
        for (let i = 0; i < indices.length; i++) {
            const cell = cells[indices[i]];
            sumX += gridX(cell.pos.col);
            sumY += gridY(cell.pos.row);
        }
        return { x: sumX / indices.length, y: sumY / indices.length };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function gridX(col: number): number {
    return col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
}
