import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { SECTIONS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Fuel Run's textures, and returns how to start it. */
export const load = definePixiLoader(async () => {
    await textures.load();

    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough for the section's banner to have faded
        thumbnailAdvanceMs: 3000,

        start({ stage, music, sfx }): EntrySession {
            const gameModel = createGameModel({
                sections: SECTIONS,
            });

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
                scoring: {
                    score: () => gameModel.score,
                    isOver: () => gameModel.phase === 'game-over',
                },
                saveGame: gameModel.save,
                loadGame: gameModel.load,
                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    showSecondary: true,
                    primaryLabel: 'Fire',
                    secondaryLabel: 'Bomb',
                    onXDirectionChanged: (dir) => { gameModel.thrustX = dir; },
                    onYDirectionChanged: (dir) => { gameModel.thrustY = dir; },
                    onPrimaryButtonChanged: (isDown) => { if (isDown) gameModel.fire(); },
                    onSecondaryButtonChanged: (isDown) => { if (isDown) gameModel.dropBomb(); },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
