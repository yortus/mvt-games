import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice, type StatefulPixiView } from '#common';
import type { GameModel } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from './view-constants';
import { createBoardView } from './board-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): StatefulPixiView {
    const boardWidth = GRID_COLS * CELL_WIDTH_PX;
    const boardHeight = GRID_ROWS * CELL_HEIGHT_PX;

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
            getSwapCell1: () => board.swapCell1,
            getSwapCell2: () => board.swapCell2,
            getSwapProgress: () => board.swapProgress,
            getSettleProgress: () => board.settleProgress,
            getSettleOriginRows: () => board.settleOriginRows,
            getMatchedCells: () => board.matchedCells,
            getCascadeStep: () => board.cascadeStep,
            onSwapRequested: (origin, target) => game.trySwap(origin, target),
        });
        view.addChild(boardView);

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
}
