import { Container } from 'pixi.js';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import type { ArcadeControls } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import { OverlayView } from '@mvtjs/site-kit/shared';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { describeControl } from '@mvtjs/site-kit/input';
import type { GameModel } from '../models';
import { GRID_ROWS, GRID_COLS } from '../data';
import { AudioView } from './audio-view';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from './view-constants';
import { BoardView } from './board-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip the game's sound effects play on, read once as `music` is. */
    sfx: SfxChip<'audio80'>;
    /** The arcade controls, which the host passes to the game as it starts. */
    controls: ArcadeControls;
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
        // The keys: only Restart
        view.addChild(ArcadeControlsInputView({ controls: bindings.controls, onRestartPressed: game.startNewRun }));

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
            canSwap: (origin, target) => game.canSwap(origin, target),
            onSwapRequested: (origin, target) => {
                game.trySwap(origin, target);
            },
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
        const restartHint = isTouchDevice() ? 'Tap to restart' : `Press ${describeControl('restart')} to restart`;
        const overlayView = OverlayView({
            width: boardWidth,
            height: boardHeight,
            isVisible: () => game.phase === 'game-over',
            text: () => `GAME OVER\n\n${restartHint}`,
            onPressed: game.startNewRun,
        });
        view.addChild(overlayView);

        // Sound
        view.addChild(AudioView({
            sfx: bindings.sfx,
            gamePhase: () => game.phase,
            boardPhase: () => game.board.phase,
            isSwapMatching: () => game.board.isSwapMatching,
            cascadeStep: () => game.board.cascadeStep,
            matchedCellCount: () => game.board.matchedCells.length,
        }));
    }
}
