import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
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
        // A touch screen steers by swiping, in the view, so no touch controls are drawn
        arcadeControls: 'keys-only',
        // Long enough for the snake to wind across the garden
        thumbnailAdvanceMs: 2400,
        // Right, then down, then back left
        thumbnailInput: (controls, elapsedMs) => {
            if (elapsedMs >= 1500) controls.setXDirection('script', 'left');
            else if (elapsedMs >= 900) controls.setYDirection('script', 'down');
        },

        start({ stage, controls }): EntrySession {
            const gameModel = createGameModel();
            const gameView = GameView({ model: gameModel, controls });
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
            };
        },
    };
});
