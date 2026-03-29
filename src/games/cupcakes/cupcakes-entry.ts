import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import { GRID_ROWS, GRID_COLS, CELL_SIZE, HUD_HEIGHT } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCupcakesEntry(): GameEntry {
    return {
        id: 'cupcakes',
        name: 'Kwazy Cupcakes',
        screenWidth: GRID_COLS * CELL_SIZE,
        screenHeight: GRID_ROWS * CELL_SIZE + HUD_HEIGHT,
        instructions: [
            'Swap adjacent cupcakes to make',
            'a row or column of 3 or more',
            'matching flavours.',
            '',
            'Drag a cupcake onto an adjacent',
            'one to swap them. Release to',
            'confirm the swap.',
            '',
            'Matched cupcakes are removed',
            'and new ones fall from above.',
            'Chain combos for bonus points!',
        ].join('\n'),

        start(stage: Container): GameSession {
            const gameModel = createGameModel({
                rows: GRID_ROWS,
                cols: GRID_COLS,
            });

            const gameView = createGameView(gameModel);
            stage.addChild(gameView);

            return {
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
            };
        },
    };
}
