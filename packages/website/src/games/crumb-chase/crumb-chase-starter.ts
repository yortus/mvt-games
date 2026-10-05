import type { EntrySession, PixiEntryStarter } from '../../entries';
import { createGameModel } from './models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import {
    MAZE_DATA,
    MOUSE_SPAWN,
    CAT_SPAWNS,
    PEN_EXIT,
    textures,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Crumb Chase's textures, and returns how to start it. */
export async function loadCrumbChaseStarter(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,

        start({ stage }): EntrySession {
            const gameModel = createGameModel({
                grid: MAZE_DATA,
                mouseSpawn: MOUSE_SPAWN,
                catSpawns: CAT_SPAWNS,
                penExit: PEN_EXIT,
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
                    showDpad: true,
                    onXDirectionChanged: (dir) => { if (dir !== 'none') gameModel.playerInput.direction = dir; },
                    onYDirectionChanged: (dir) => { if (dir !== 'none') gameModel.playerInput.direction = dir; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
