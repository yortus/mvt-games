import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { FIELD_ROWS, FIELD_COLS, BASE_FIELD, DIGGER_SPAWN, LEVELS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Burrow Bust's textures, and returns how to start it. */
export async function load(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,

        start({ stage }): EntrySession {
            const gameModel = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const gameView = GameView({ model: gameModel });
            stage.addChild(gameView);

            let lastXDir: 'left' | 'none' | 'right' = 'none';
            let lastYDir: 'up' | 'none' | 'down' = 'none';

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
                    primaryLabel: 'Pump',
                    onXDirectionChanged: (dir) => {
                        lastXDir = dir;
                        if (dir === 'left') gameModel.playerInput.direction = 'left';
                        else if (dir === 'right') gameModel.playerInput.direction = 'right';
                        else if (lastYDir === 'up') gameModel.playerInput.direction = 'up';
                        else if (lastYDir === 'down') gameModel.playerInput.direction = 'down';
                        else gameModel.playerInput.direction = 'none';
                    },
                    onYDirectionChanged: (dir) => {
                        lastYDir = dir;
                        if (dir === 'up') gameModel.playerInput.direction = 'up';
                        else if (dir === 'down') gameModel.playerInput.direction = 'down';
                        else if (lastXDir === 'left') gameModel.playerInput.direction = 'left';
                        else if (lastXDir === 'right') gameModel.playerInput.direction = 'right';
                        else gameModel.playerInput.direction = 'none';
                    },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.pumpPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
