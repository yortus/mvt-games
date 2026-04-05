import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice, type StatefulPixiView } from '#common';
import type { GameModel } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_SIZE_PX } from './view-constants';
import { createBoardView } from './board-view';
import { createDragViewModel } from './drag-view-model';
import { createGridDragGesture } from './grid-drag-gesture';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): StatefulPixiView {
    const boardWidth = GRID_COLS * CELL_SIZE_PX;
    const boardHeight = GRID_ROWS * CELL_SIZE_PX;

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
    const drag = createDragViewModel();

    const view = new Container();
    let boardView: StatefulPixiView;
    initialiseView();
    const update = (deltaMs: number) => boardView.update(deltaMs);
    return Object.assign(view, { update });

    function initialiseView(): void {
        const board = game.board;
        boardView = createBoardView({
            getPhase: () => board.phase,
            getCells: () => board.cells,
            getSwapPos1: () => board.swapPos1,
            getSwapPos2: () => board.swapPos2,
            getSwapProgress: () => board.swapProgress,
            getSettleOrigins: () => board.settleOrigins,
            getSettleProgress: () => board.settleProgress,
            getMatchedIndices: () => board.matchedIndices,
            getCascadeStep: () => board.cascadeStep,
        }, gesture, drag);
        view.addChild(boardView);

        // Drag input on the board area
        view.eventMode = 'static';
        view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < boardWidth && y >= 0 && y < boardHeight };
        view.on('pointerdown', onPointerDown);
        view.on('globalpointermove', onPointerMove);
        view.on('pointerup', onPointerUp);
        view.on('pointerupoutside', onPointerUp);

        // HUD
        const hudView = createHudView({
            getScore: () => game.score,
            getScreenWidth: () => boardWidth,
        });
        hudView.position.set(0, boardHeight);
        view.addChild(hudView);

        // Game over overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        const overlayView = createOverlayView({
            getWidth: () => boardWidth,
            getHeight: () => boardHeight,
            getVisible: () => game.phase === 'game-over',
            getText: () => `GAME OVER\n\n${restartHint}`,
        });
        view.addChild(overlayView);
    }

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        if (game.board.phase !== 'idle') return;
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

        if (gesture.target.row >= 0 && game.trySwap(gesture.origin, gesture.target)) {
            drag.commitSwap(gesture.origin, gesture.target);
        }
        gesture.end();
    }
}
