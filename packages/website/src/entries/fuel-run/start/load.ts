import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { SECTIONS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Fuel Run's textures, and returns how to start it. */
export async function load(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough for the section's banner to have faded
        thumbnailAdvanceMs: 3000,

        start({ stage, sound }): EntrySession {
            const gameModel = createGameModel({
                sections: SECTIONS,
            });

            const gameView = GameView({ model: gameModel, sound });
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
                    showSecondary: true,
                    primaryLabel: 'Fire',
                    secondaryLabel: 'Bomb',
                    onXDirectionChanged: (dir) => { gameModel.playerInput.xDirection = dir; },
                    onYDirectionChanged: (dir) => { gameModel.playerInput.yDirection = dir; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.firePressed = pressed; },
                    onSecondaryButtonChanged: (pressed) => { gameModel.playerInput.bombPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
