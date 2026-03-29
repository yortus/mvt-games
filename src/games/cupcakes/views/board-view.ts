import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';
import type { BoardModel } from '../models';
import { CELL_SIZE } from '../data';
import { createCupcakeView } from './cupcake-view';

// ---------------------------------------------------------------------------
// Drag state (shared mutable object written by game-view)
// ---------------------------------------------------------------------------

export interface DragState {
    active: boolean;
    originRow: number;
    originCol: number;
    candidateRow: number;
    candidateCol: number;
    pointerX: number;
    pointerY: number;
    /** True after trySwap accepted - view holds swapped positions until model exits 'swapping'. */
    committedSwap: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const LERP_FACTOR = 0.25;
const SNAP_THRESHOLD = 0.5;

export function createBoardView(board: BoardModel, drag: DragState): Container {
    const view = new Container();
    view.sortableChildren = true;
    const watcher = watch({ cellCount: () => board.cells.length });
    let cupcakeContainers: Container[] = [];

    // Presentation state for drag candidate animation
    let prevCandidateIdx = -1;
    let candidateVisualX = 0;
    let candidateVisualY = 0;
    let returningIdx = -1;
    let returningVisualX = 0;
    let returningVisualY = 0;

    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        // Grid background
        const bg = new Graphics();
        bg.zIndex = -1;
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                const shade = (r + c) % 2 === 0 ? 0x3A2A4A : 0x2E1E3E;
                bg.rect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE).fill(shade);
            }
        }
        view.addChild(bg);

        buildCupcakes();
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.cellCount.changed) {
            buildCupcakes();
        }
        updateDragPresentation();
    }

    function updateDragPresentation(): void {
        // Committed swap override: hold cells at swapped positions during 'swapping'
        if (drag.committedSwap) {
            if (board.phase !== 'swapping') {
                drag.committedSwap = false;
                prevCandidateIdx = -1;
                returningIdx = -1;
            }
            return;
        }

        const originIdx = drag.active ?
            drag.originRow * board.cols + drag.originCol :
                -1;
        const candidateIdx = drag.active && drag.candidateRow >= 0 ?
            drag.candidateRow * board.cols + drag.candidateCol :
                -1;

        // Candidate changed - send previous candidate to return animation
        if (candidateIdx !== prevCandidateIdx) {
            // Only animate return if model didn't take over (i.e. swap was not accepted)
            if (prevCandidateIdx >= 0 && board.phase === 'idle') {
                returningIdx = prevCandidateIdx;
                returningVisualX = candidateVisualX;
                returningVisualY = candidateVisualY;
            }
            if (candidateIdx >= 0) {
                const cell = board.cells[candidateIdx];
                candidateVisualX = cell.col * CELL_SIZE + CELL_SIZE * 0.5;
                candidateVisualY = cell.row * CELL_SIZE + CELL_SIZE * 0.5;
            }
            prevCandidateIdx = candidateIdx;
        }

        // Lerp candidate toward origin cell position
        if (candidateIdx >= 0) {
            const targetX = drag.originCol * CELL_SIZE + CELL_SIZE * 0.5;
            const targetY = drag.originRow * CELL_SIZE + CELL_SIZE * 0.5;
            candidateVisualX += (targetX - candidateVisualX) * LERP_FACTOR;
            candidateVisualY += (targetY - candidateVisualY) * LERP_FACTOR;
        }

        // Lerp returning cell back to its grid position
        if (returningIdx >= 0) {
            const cell = board.cells[returningIdx];
            if (cell) {
                const gridX = cell.col * CELL_SIZE + CELL_SIZE * 0.5;
                const gridY = cell.row * CELL_SIZE + CELL_SIZE * 0.5;
                returningVisualX += (gridX - returningVisualX) * LERP_FACTOR;
                returningVisualY += (gridY - returningVisualY) * LERP_FACTOR;
                if (Math.abs(returningVisualX - gridX) < SNAP_THRESHOLD &&
                    Math.abs(returningVisualY - gridY) < SNAP_THRESHOLD) {
                    returningIdx = -1;
                }
            }
            else {
                returningIdx = -1;
            }
        }

        // Z-order: dragged cupcake renders on top
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].zIndex = (i === originIdx) ? 100 : 0;
        }
    }

    function getCellX(idx: number): number {
        if (drag.committedSwap) {
            const oIdx = drag.originRow * board.cols + drag.originCol;
            const cIdx = drag.candidateRow * board.cols + drag.candidateCol;
            if (idx === oIdx) return drag.candidateCol * CELL_SIZE + CELL_SIZE * 0.5;
            if (idx === cIdx) return drag.originCol * CELL_SIZE + CELL_SIZE * 0.5;
        }
        if (drag.active && idx === drag.originRow * board.cols + drag.originCol) {
            return drag.pointerX;
        }
        if (idx === prevCandidateIdx && drag.active) return candidateVisualX;
        if (idx === returningIdx) return returningVisualX;
        return board.cells[idx].col * CELL_SIZE + CELL_SIZE * 0.5;
    }

    function getCellY(idx: number): number {
        if (drag.committedSwap) {
            const oIdx = drag.originRow * board.cols + drag.originCol;
            const cIdx = drag.candidateRow * board.cols + drag.candidateCol;
            if (idx === oIdx) return drag.candidateRow * CELL_SIZE + CELL_SIZE * 0.5;
            if (idx === cIdx) return drag.originRow * CELL_SIZE + CELL_SIZE * 0.5;
        }
        if (drag.active && idx === drag.originRow * board.cols + drag.originCol) {
            return drag.pointerY;
        }
        if (idx === prevCandidateIdx && drag.active) return candidateVisualY;
        if (idx === returningIdx) return returningVisualY;
        return board.cells[idx].row * CELL_SIZE + CELL_SIZE * 0.5;
    }

    function buildCupcakes(): void {
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].destroy({ children: true });
        }
        cupcakeContainers = [];

        const count = board.cells.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createCupcakeView({
                getKind: () => board.cells[idx].kind,
                getX: () => getCellX(idx),
                getY: () => getCellY(idx),
                getAlpha: () => board.cells[idx].alpha,
            });
            view.addChild(c);
            cupcakeContainers.push(c);
        }
    }
}
