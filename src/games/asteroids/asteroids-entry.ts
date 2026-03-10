import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import { SCREEN_WIDTH, PLAY_HEIGHT, HUD_HEIGHT } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAsteroidsEntry(): GameEntry {
    return {
        id: 'asteroids',
        name: 'Asteroids',
        screenWidth: SCREEN_WIDTH,
        screenHeight: PLAY_HEIGHT + HUD_HEIGHT,

        start(stage: Container): GameSession {
            const gameModel = createGameModel({
                arenaWidth: SCREEN_WIDTH,
                arenaHeight: PLAY_HEIGHT,
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
