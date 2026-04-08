import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import { GRID_ROWS, GRID_COLS, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCactiiEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'cactii',
        name: 'Kwazy Cactii',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        instructions: [
            'Swap adjacent cactii to make',
            'a row or column of 3 or more',
            'matching species.',
            '',
            'Drag a cactus onto an adjacent',
            'one to swap them. Release to',
            'confirm the swap.',
            '',
            'Matched cactii are removed',
            'and new ones fall from above.',
            'Chain combos for bonus points!',
        ].join('\n'),

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('cactii: load() must be called before start()');
            const gameModel = createGameModel({
                rowCount: GRID_ROWS,
                colCount: GRID_COLS,
            });

            const gameView = createGameView(gameModel);
            stage.addChild(gameView);

            return {
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                    gameView.update(deltaMs);
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
