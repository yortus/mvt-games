import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { loadSpriteTextures, type SpriteTextures } from '#utils';
import { createGameModel } from './models';
import { createGameView, type GameViewTextures } from './views';
import {
    SCREEN_WIDTH,
    PLAY_HEIGHT,
    HUD_HEIGHT,
    SHIP_Y,
    SHIP_SPEED,
    SHIP_HALF_WIDTH,
    WAVES,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGalagaEntry(): GameEntry {
    let textures: SpriteTextures | undefined;

    return {
        id: 'galaga',
        name: 'Galaga',
        screenWidth: SCREEN_WIDTH,
        screenHeight: PLAY_HEIGHT + HUD_HEIGHT,
        thumbnailAdvanceMs: 2000,

        async preload(): Promise<void> {
            textures = await loadSpriteTextures('sprites/galaga-sprites.json');
        },

        start(stage: Container): GameSession {
            if (!textures) throw new Error('galaga: preload() must be called before start()');

            const gameModel = createGameModel({
                waves: WAVES,
                playHeight: PLAY_HEIGHT,
                shipStartX: SCREEN_WIDTH / 2,
                shipStartY: SHIP_Y,
                shipSpeed: SHIP_SPEED,
                shipMinX: SHIP_HALF_WIDTH,
                shipMaxX: SCREEN_WIDTH - SHIP_HALF_WIDTH,
            });

            const gameTextures: GameViewTextures = {
                boss: textures['boss'],
                butterfly: textures['butterfly'],
                bee: textures['bee'],
                ship: textures['ship'],
                'ship-icon': textures['ship-icon'],
            };

            const gameView = createGameView(gameModel, gameTextures);
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
