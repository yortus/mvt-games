import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice, type StatefulPixiView } from '#common';
import type { GameModel } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { CELL_SIZE_PX } from './view-constants';
import { createBoardView } from './board-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): StatefulPixiView {
    const boardWidth = GRID_COLS * CELL_SIZE_PX;
    const boardHeight = GRID_ROWS * CELL_SIZE_PX;

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
