import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import { ARENA_WIDTH, ARENA_HEIGHT, HUD_HEIGHT, SHIP_Y, SHIP_SPEED, SHIP_HALF_WIDTH, WAVES, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGalagaEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'galaga',
        name: 'Galaga',
        screenWidth: ARENA_WIDTH,
        screenHeight: ARENA_HEIGHT + HUD_HEIGHT,
        thumbnailAdvanceMs: 2000,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('galaga: preload() must be called before start()');

            const gameModel = createGameModel({
                waves: WAVES,
                playHeight: ARENA_HEIGHT,
                shipStartX: ARENA_WIDTH / 2,
                shipStartY: SHIP_Y,
                shipSpeed: SHIP_SPEED,
                shipMinX: SHIP_HALF_WIDTH,
                shipMaxX: ARENA_WIDTH - SHIP_HALF_WIDTH,
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
