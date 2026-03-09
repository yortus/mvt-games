import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, type GameViewBindings } from './views';
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
            const game = createGameModel({
                arenaWidth: SCREEN_WIDTH,
                arenaHeight: PLAY_HEIGHT,
            });

            const bindings: GameViewBindings = {
                getScreenWidth: () => SCREEN_WIDTH,
                getPlayHeight: () => PLAY_HEIGHT,
                getShipX: () => game.ship.x,
                getShipY: () => game.ship.y,
                getShipAngle: () => game.ship.angle,
                isShipAlive: () => game.ship.alive,
                isShipThrusting: () => game.ship.thrusting,
                getAsteroidCount: () => game.asteroids.length,
                getAsteroidX: (i) => game.asteroids[i].x,
                getAsteroidY: (i) => game.asteroids[i].y,
                getAsteroidAngle: (i) => game.asteroids[i].angle,
                getAsteroidSize: (i) => game.asteroids[i].size,
                getAsteroidRadius: (i) => game.asteroids[i].radius,
                isAsteroidAlive: (i) => game.asteroids[i].alive,
                getAsteroidShapeSeed: (i) => game.asteroids[i].shapeSeed,
                getBulletCount: () => game.bullets.length,
                getBulletX: (i) => game.bullets[i].x,
                getBulletY: (i) => game.bullets[i].y,
                isBulletActive: (i) => game.bullets[i].active,
                getScore: () => game.score.score,
                getLives: () => game.score.lives,
                getWave: () => game.score.wave,
                getGamePhase: () => game.phase,
                getPlayerInput: () => game.playerInput,
            };

            const gameContainer = createGameView(bindings);
            stage.addChild(gameContainer);

            return {
                update(deltaMs: number): void {
                    game.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameContainer);
                    gameContainer.destroy({ children: true });
                },
            };
        },
    };
}
