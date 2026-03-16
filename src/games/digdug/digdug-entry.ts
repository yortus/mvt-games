import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import {
    TILE_SIZE,
    FIELD_ROWS,
    FIELD_COLS,
    HUD_HEIGHT,
    BASE_FIELD,
    DIGGER_SPAWN,
    LEVELS,
    textures,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDigdugEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'digdug',
        name: 'Dig Dug',
        screenWidth: FIELD_COLS * TILE_SIZE,
        screenHeight: FIELD_ROWS * TILE_SIZE + HUD_HEIGHT,

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
