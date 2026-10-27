import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Dojo Duel, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2000,

        start({ stage, music, sfx }): EntrySession {
            const gameModel = createGameModel();
            const gameView = GameView({ model: gameModel, music, sfx });
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
                    onXDirectionChanged: (dir) => { gameModel.horizontalLean = dir; },
                    onYDirectionChanged: (dir) => { gameModel.verticalLean = dir; },
                    onPrimaryButtonChanged: (isDown) => { gameModel.isAttacking = isDown; },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
