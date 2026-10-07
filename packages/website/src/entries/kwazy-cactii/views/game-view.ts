import { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import type { GameModel } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from './view-constants';
import { BoardView } from './board-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function GameView(bindings: GameViewBindings): Container {
    const game = bindings.model;
    const boardWidth = GRID_COLS * CELL_WIDTH_PX;
    const boardHeight = GRID_ROWS * CELL_HEIGHT_PX;

    const view = new Container();
    initialiseView();
    return view;

    function initialiseView(): void {
        // Read game.board in each binding, not once here: a restart replaces the board
        const boardView = BoardView({
            phase: () => game.board.phase,
            cells: () => game.board.cells,
            swapCell1: () => game.board.swapCell1,
            swapCell2: () => game.board.swapCell2,
            swapProgress: () => game.board.swapProgress,
            settleProgress: () => game.board.settleProgress,
            settleOriginRows: () => game.board.settleOriginRows,
            matchedCells: () => game.board.matchedCells,
            cascadeStep: () => game.board.cascadeStep,
            onSwapRequested: (origin, target) => game.trySwap(origin, target),
        });
        view.addChild(boardView);

        // HUD
        const hudView = HudView({
            score: () => game.score,
            screenWidth: () => boardWidth,
        });
        hudView.position.set(0, boardHeight);
        view.addChild(hudView);

        // Game over overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        const overlayView = OverlayView({
            width: boardWidth,
            height: boardHeight,
            isVisible: () => game.phase === 'game-over',
            text: () => `GAME OVER\n\n${restartHint}`,
            onRestartPressed: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        });
        view.addChild(overlayView);
    }
}
