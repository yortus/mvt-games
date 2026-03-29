import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import { FIELD_ROWS, FIELD_COLS, BASE_FIELD, DIGGER_SPAWN, LEVELS, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDigdugEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'digdug',
        name: 'Dig Dug',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('digdug: preload() must be called before start()');

            const gameModel = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const gameView = createGameView(gameModel);
            stage.addChild(gameView);

            let lastXDir: 'left' | 'none' | 'right' = 'none';
            let lastYDir: 'up' | 'none' | 'down' = 'none';

            return {
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
