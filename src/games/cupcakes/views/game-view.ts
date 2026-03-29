import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice } from '#common';
import type { GameModel, Position } from '../models';
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from '../data';
import { createBoardView } from './board-view';
import type { DragState } from './board-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const boardWidth = GRID_COLS * CELL_SIZE;
    const boardHeight = GRID_ROWS * CELL_SIZE;

    const drag: DragState = {
        active: false,
        origin: { row: -1, col: -1 },
        candidate: { row: -1, col: -1 },
        pointer: { x: 0, y: 0 },
        committedSwap: false,
    };

    const view = new Container();
    initialiseView();
    return view;

    function initialiseView(): void {
        const board = game.board;
        const boardView = createBoardView({
            getClockMs: () => game.clockMs,
            getPhase: () => board.phase,
            getCells: () => board.cells,
            getSwapPos1: () => board.swapPos1,
            getSwapPos2: () => board.swapPos2,
            getSwapProgress: () => board.swapProgress,
            getSettleOrigins: () => board.settleOrigins,
            getSettleProgress: () => board.settleProgress,
            getMatchedIndices: () => board.matchedIndices,
            getMatchProgress: () => board.matchProgress,
        }, drag);
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

    function toGridPos(localX: number, localY: number): Position {
        return {
            row: Math.floor(localY / CELL_SIZE),
            col: Math.floor(localX / CELL_SIZE),
        };
    }

    function isValidPos(pos: Position): boolean {
        return pos.row >= 0 && pos.row < GRID_ROWS && pos.col >= 0 && pos.col < GRID_COLS;
    }

    function isAdjacentToOrigin(pos: Position): boolean {
        const dr = Math.abs(pos.row - drag.origin.row);
        const dc = Math.abs(pos.col - drag.origin.col);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        if (game.board.phase !== 'idle') return;

        const local = view.toLocal(e.global);
        const pos = toGridPos(local.x, local.y);
        if (!isValidPos(pos)) return;

        drag.active = true;
        drag.origin.row = pos.row;
        drag.origin.col = pos.col;
        drag.candidate.row = -1;
        drag.candidate.col = -1;
        drag.pointer.x = local.x;
        drag.pointer.y = local.y;
    }

    function onPointerMove(e: { global: { x: number; y: number } }): void {
        if (!drag.active) return;
        const local = view.toLocal(e.global);
        drag.pointer.x = local.x;
        drag.pointer.y = local.y;

        const pos = toGridPos(local.x, local.y);
        if (isValidPos(pos) &&
            !(pos.row === drag.origin.row && pos.col === drag.origin.col) &&
            isAdjacentToOrigin(pos)) {
            drag.candidate.row = pos.row;
            drag.candidate.col = pos.col;
        }
        else {
            drag.candidate.row = -1;
            drag.candidate.col = -1;
        }
    }

    function onPointerUp(): void {
        if (!drag.active) return;
        drag.active = false;

        if (drag.candidate.row >= 0 && game.trySwap(drag.origin, drag.candidate)) {
            // Swap accepted - keep origin/candidate info so board-view holds
            // cells at swapped positions during the model's 'swapping' phase.
            drag.committedSwap = true;
        }
        else {
            drag.candidate.row = -1;
            drag.candidate.col = -1;
        }
    }
}
