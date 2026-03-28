import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice } from '#common';
import type { GameModel } from '../models';
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from '../data';
import { createBoardView } from './board-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const boardWidth = GRID_COLS * CELL_SIZE;
    const boardHeight = GRID_ROWS * CELL_SIZE;

    const view = new Container();
    initialiseView();
    return view;

    function initialiseView(): void {
        // Board
        const boardView = createBoardView(game.board);
        view.addChild(boardView);

        // Click / tap input on the board area
        view.eventMode = 'static';
        view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < boardWidth && y >= 0 && y < boardHeight };
        view.on('pointertap', (e) => {
            const local = view.toLocal(e.global);
            const col = Math.floor(local.x / CELL_SIZE);
            const row = Math.floor(local.y / CELL_SIZE);
            game.selectCell(row, col);
        });

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
