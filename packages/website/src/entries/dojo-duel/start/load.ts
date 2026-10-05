import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Dojo Duel, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2000,

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

                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    primaryLabel: 'Atk',
                    onXDirectionChanged: (dir) => { gameModel.playerInput.xDirection = dir; },
                    onYDirectionChanged: (dir) => { gameModel.playerInput.yDirection = dir; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.attackPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
