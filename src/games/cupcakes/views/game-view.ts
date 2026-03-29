import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice } from '#common';
import type { GameModel } from '../models';
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
        originRow: -1,
        originCol: -1,
        candidateRow: -1,
        candidateCol: -1,
        pointerX: 0,
        pointerY: 0,
        committedSwap: false,
    };

    const view = new Container();
    initialiseView();
    return view;

    function initialiseView(): void {
        // Board
        const boardView = createBoardView(game.board, drag);
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

    function toGridCell(localX: number, localY: number): { row: number; col: number } {
        return {
            col: Math.floor(localX / CELL_SIZE),
            row: Math.floor(localY / CELL_SIZE),
        };
    }

    function isValidCell(row: number, col: number): boolean {
        return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
    }

    function isAdjacentToOrigin(row: number, col: number): boolean {
        const dr = Math.abs(row - drag.originRow);
        const dc = Math.abs(col - drag.originCol);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        if (game.board.phase !== 'idle') return;

        const local = view.toLocal(e.global);
        const { row, col } = toGridCell(local.x, local.y);
        if (!isValidCell(row, col)) return;

        drag.active = true;
        drag.originRow = row;
        drag.originCol = col;
        drag.candidateRow = -1;
        drag.candidateCol = -1;
        drag.pointerX = local.x;
        drag.pointerY = local.y;
    }

    function onPointerMove(e: { global: { x: number; y: number } }): void {
        if (!drag.active) return;
        const local = view.toLocal(e.global);
        drag.pointerX = local.x;
        drag.pointerY = local.y;

        const { row, col } = toGridCell(local.x, local.y);
        if (isValidCell(row, col) &&
            !(row === drag.originRow && col === drag.originCol) &&
            isAdjacentToOrigin(row, col)) {
            drag.candidateRow = row;
            drag.candidateCol = col;
        }
        else {
            drag.candidateRow = -1;
            drag.candidateCol = -1;
        }
    }

    function onPointerUp(): void {
        if (!drag.active) return;

        const r1 = drag.originRow;
        const c1 = drag.originCol;
        const r2 = drag.candidateRow;
        const c2 = drag.candidateCol;

        drag.active = false;

        if (r2 >= 0 && game.trySwap(r1, c1, r2, c2)) {
            // Swap accepted - keep origin/candidate info so board-view holds
            // cells at swapped positions during the model's 'swapping' phase.
            drag.committedSwap = true;
        }
        else {
            drag.candidateRow = -1;
            drag.candidateCol = -1;
        }
    }
}
