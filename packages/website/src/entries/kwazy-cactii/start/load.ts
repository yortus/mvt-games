import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { GRID_ROWS, GRID_COLS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Kwazy Cactii's textures, and returns how to start it. */
export async function load(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,

        start({ stage }): EntrySession {
            const gameModel = createGameModel({
                rowCount: GRID_ROWS,
                colCount: GRID_COLS,
            });

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
                    showDpad: false,
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
