import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { FIELD_ROWS, FIELD_COLS, BASE_FIELD, DIGGER_SPAWN, LEVELS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Burrow Bust's textures, and returns how to start it. */
export const load = definePixiLoader(async () => {
    await textures.load();

    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,

        start({ stage, music, sfx }): EntrySession {
            const gameModel = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const gameView = GameView({ model: gameModel, music, sfx });
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
                scoring: {
                    score: () => gameModel.score,
                    isOver: () => gameModel.phase === 'game-over',
                },
                saveGame: gameModel.save,
                loadGame: gameModel.load,
                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    primaryLabel: 'Pump',
                    onXDirectionChanged: (dir) => {
                        lastXDir = dir;
                        if (dir === 'left') gameModel.direction = 'left';
                        else if (dir === 'right') gameModel.direction = 'right';
                        else if (lastYDir === 'up') gameModel.direction = 'up';
                        else if (lastYDir === 'down') gameModel.direction = 'down';
                        else gameModel.direction = 'none';
                    },
                    onYDirectionChanged: (dir) => {
                        lastYDir = dir;
                        if (dir === 'up') gameModel.direction = 'up';
                        else if (dir === 'down') gameModel.direction = 'down';
                        else if (lastXDir === 'left') gameModel.direction = 'left';
                        else if (lastXDir === 'right') gameModel.direction = 'right';
                        else gameModel.direction = 'none';
                    },
                    // Holding the button keeps the harpoon out, and each press pumps
                    onPrimaryButtonChanged: (isDown) => {
                        gameModel.isHarpoonOut = isDown;
                        if (isDown) gameModel.pump();
                    },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
