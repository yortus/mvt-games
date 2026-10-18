import { isTouchDevice } from '#shared';
import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Garden Snake, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Long enough for the snake to wind across the garden
        thumbnailAdvanceMs: 2400,
        // Right, then down, then back left
        thumbnailInput: (session, elapsedMs) => {
            if (elapsedMs >= 1500) session.inputConfig?.onXDirectionChanged?.('left');
            else if (elapsedMs >= 900) session.inputConfig?.onYDirectionChanged?.('down');
        },

        start({ stage }): EntrySession {
            const gameModel = createGameModel();
            const gameView = GameView({ model: gameModel });
            stage.addChild(gameView);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
                scoring: {
                    score: () => gameModel.score,
                    isOver: () => gameModel.phase === 'game-over',
                },
                inputConfig: {
                    // A touch screen steers by swiping, in the view
                    showDpad: !isTouchDevice(),
                    // A direction held stays the snake's way until another is pressed
                    onXDirectionChanged: (dir) => { if (dir !== 'none') gameModel.direction = dir; },
                    onYDirectionChanged: (dir) => { if (dir !== 'none') gameModel.direction = dir; },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
