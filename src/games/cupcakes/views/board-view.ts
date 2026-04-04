import gsap from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { watch, createSequenceReaction, type Sequence } from '#common';
import type { BoardPhase, CupcakeCell } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_SIZE_PX } from './view-constants';
import { createCupcakeView } from './cupcake-view';
import { computeCellLayout } from './cell-layout';
import type { BoardSnapshot, DragSnapshot } from './cell-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    getClockMs(): number;
    getPhase(): BoardPhase;
    getCells(): readonly Readonly<CupcakeCell>[];
    getSwapPos1(): { col: number; row: number };
    getSwapPos2(): { col: number; row: number };
    getSwapProgress(): number;
    getSettleOrigins(): readonly number[];
    getSettleProgress(): number;
    getMatchedIndices(): readonly number[];
    getMatchProgress(): number;
    getMatchSequence(): Sequence<'fade' | 'shake' | 'dust' | 'popup'>;
    getCascadeStep(): number;
}

// ---------------------------------------------------------------------------
// Drag state (shared mutable object written by game-view)
// ---------------------------------------------------------------------------

export interface DragState {
    active: boolean;
    origin: { col: number; row: number };
    candidate: { col: number; row: number };
    pointer: { x: number; y: number };
    /** True after trySwap accepted - view holds swapped positions until model exits 'swapping'. */
    committedSwap: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANDIDATE_SLIDE_DURATION = 0.12;
const RETURN_SLIDE_DURATION = 0.15;

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardView(bindings: BoardViewBindings, drag: DragState): Container {
    const view = new Container();
    view.sortableChildren = true;
    const watcher = watch({ cellCount: () => bindings.getCells().length });
    let cupcakeContainers: Container[] = [];

    // Board content container (offset by shake)
    const boardContent = new Container();
    boardContent.sortableChildren = true;
    view.addChild(boardContent);

    // Presentation state for drag tweens (targets mutated by GSAP)
    const candidateVisual = { x: 0, y: 0 };
    const returningVisual = { x: 0, y: 0 };
    let prevCandidateIdx = -1;
    let candidateIdx = -1;
    let returningIdx = -1;

    // GSAP paused timeline for drag presentation animations
    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });
    let prevClockMs = 0;

    // Cached per-frame settle data
    let settleMaxDist = 0;

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
    const popupText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: POPUP_FONT_SIZE, fill: 0xffff00, fontWeight: 'bold' },
    });
    popupText.anchor.set(0.5);
    popupText.alpha = 0;
    popupText.zIndex = 60;
    view.addChild(popupText);

    // Cached matched-cell centre for popup positioning
    const matchCentre = { x: 0, y: 0 };

    // Pre-allocated snapshot objects to avoid per-cell allocation
    const boardSnap: BoardSnapshot = {
        colCount: 0,
        phase: 'idle',
        cellPos: { col: 0, row: 0 },
        cellIsAlive: true,
        swapPos1: { row: -1, col: -1 },
        swapPos2: { row: -1, col: -1 },
        swapProgress: 0,
        settleOrigin: NaN,
        settleProgress: 0,
        settleMaxDist: 0,
        matchProgress: 0,
        isMatched: false,
    };

    // Compound references point to the live drag/visual objects -
    // only scalar flags need updating per frame in fillDragSnapshot().
    const dragSnap: DragSnapshot = {
        active: false,
        committedSwap: false,
        originIdx: -1,
        candidateIdx: -1,
        pointer: drag.pointer,
        origin: drag.origin,
        candidate: drag.candidate,
        candidateVisual,
        returningIdx: -1,
        returningVisual,
    };

    // ---- Match effect reactions (dispatched by step lifecycle) ---------------

    const updateMatchEffects = createSequenceReaction(bindings.getMatchSequence(), {
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
                    const cx = cell.pos.col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                    const cy = cell.pos.row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
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
                computeMatchCentre(bindings.getMatchedIndices(), matchCentre);
                const cascade = bindings.getCascadeStep();
                const matchCount = bindings.getMatchedIndices().length;
                const pts = matchCount * 10;
                popupText.text = cascade > 1 ? `+${pts} x${cascade}` : `+${pts}`;
            },
            active: (progress) => {
                popupText.position.set(matchCentre.x, matchCentre.y - POPUP_RISE_PX * progress);
                popupText.alpha = 1 - progress * progress;
            },
        },
    });

    initialiseView();
    view.onRender = refresh;
    return view;

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

        // Advance GSAP timeline by ticker-driven delta
        const clockMs = bindings.getClockMs();
        const deltaMs = clockMs - prevClockMs;
        prevClockMs = clockMs;
        if (deltaMs > 0) {
            timeline.time(timeline.time() + deltaMs * 0.001);
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
        if (drag.committedSwap) {
            if (bindings.getPhase() !== 'swapping') {
                drag.committedSwap = false;
                prevCandidateIdx = -1;
                candidateIdx = -1;
                returningIdx = -1;
            }
            return;
        }

        const newCandidateIdx = drag.active && drag.candidate.row >= 0 ?
            drag.candidate.row * GRID_COLS + drag.candidate.col :
                -1;

        if (newCandidateIdx !== prevCandidateIdx) {
            // Previous candidate starts returning to grid
            if (prevCandidateIdx >= 0 && bindings.getPhase() === 'idle') {
                returningIdx = prevCandidateIdx;
                returningVisual.x = candidateVisual.x;
                returningVisual.y = candidateVisual.y;

                const cell = bindings.getCells()[returningIdx];
                const targetX = cell.pos.col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                const targetY = cell.pos.row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                const t = timeline.time();
                timeline.to(returningVisual, {
                    x: targetX,
                    y: targetY,
                    duration: RETURN_SLIDE_DURATION,
                    ease: 'power2.out',
                    onComplete: () => { returningIdx = -1; },
                }, t);
            }

            // New candidate starts sliding toward origin
            if (newCandidateIdx >= 0) {
                const cell = bindings.getCells()[newCandidateIdx];
                candidateVisual.x = cell.pos.col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                candidateVisual.y = cell.pos.row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;

                const targetX = drag.origin.col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                const targetY = drag.origin.row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
                const t = timeline.time();
                timeline.to(candidateVisual, {
                    x: targetX,
                    y: targetY,
                    duration: CANDIDATE_SLIDE_DURATION,
                    ease: 'power2.out',
                }, t);
            }

            prevCandidateIdx = newCandidateIdx;
        }

        candidateIdx = newCandidateIdx;
    }

    function fillBoardSnapshot(idx: number): void {
        const cell = bindings.getCells()[idx];
        boardSnap.colCount = GRID_COLS;
        boardSnap.phase = bindings.getPhase();
        boardSnap.cellPos = cell.pos;
        boardSnap.cellIsAlive = cell.isAlive;
        boardSnap.swapPos1 = bindings.getSwapPos1();
        boardSnap.swapPos2 = bindings.getSwapPos2();
        boardSnap.swapProgress = bindings.getSwapProgress();
        boardSnap.settleOrigin = bindings.getSettleOrigins()[idx];
        boardSnap.settleProgress = bindings.getSettleProgress();
        boardSnap.settleMaxDist = settleMaxDist;
        boardSnap.matchProgress = bindings.getMatchProgress();

        let matched = false;
        if (boardSnap.phase === 'matching') {
            const indices = bindings.getMatchedIndices();
            for (let m = 0; m < indices.length; m++) {
                if (indices[m] === idx) {
                    matched = true;
                    break;
                }
            }
        }
        boardSnap.isMatched = matched;
    }

    function fillDragSnapshot(): void {
        dragSnap.active = drag.active;
        dragSnap.committedSwap = drag.committedSwap;
        dragSnap.originIdx = (drag.active || drag.committedSwap) ?
            drag.origin.row * GRID_COLS + drag.origin.col :
                -1;
        dragSnap.candidateIdx = candidateIdx;
        dragSnap.returningIdx = returningIdx;
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
        fillBoardSnapshot(idx);
        fillDragSnapshot();
        return computeCellLayout(idx, CELL_SIZE_PX, boardSnap, dragSnap).x;
    }

    function getCellY(idx: number): number {
        return computeCellLayout(idx, CELL_SIZE_PX, boardSnap, dragSnap).y;
    }

    function getCellAlpha(idx: number): number {
        return computeCellLayout(idx, CELL_SIZE_PX, boardSnap, dragSnap).alpha;
    }

    // ---- Match effects (helpers) -------------------------------------------

    function computeMatchCentre(indices: readonly number[], out: { x: number; y: number }): void {
        if (indices.length === 0) {
            out.x = 0;
            out.y = 0;
            return;
        }
        let sumX = 0;
        let sumY = 0;
        const cells = bindings.getCells();
        for (let i = 0; i < indices.length; i++) {
            const cell = cells[indices[i]];
            sumX += cell.pos.col * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
            sumY += cell.pos.row * CELL_SIZE_PX + CELL_SIZE_PX * 0.5;
        }
        out.x = sumX / indices.length;
        out.y = sumY / indices.length;
    }
}
