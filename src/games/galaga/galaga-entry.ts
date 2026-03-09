import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, type GameViewBindings } from './views';
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
    return {
        id: 'galaga',
        name: 'Galaga',
        screenWidth: SCREEN_WIDTH,
        screenHeight: PLAY_HEIGHT + HUD_HEIGHT,

        start(stage: Container): GameSession {
            const game = createGameModel({
                waves: WAVES,
                playHeight: PLAY_HEIGHT,
                shipStartX: SCREEN_WIDTH / 2,
                shipStartY: SHIP_Y,
                shipSpeed: SHIP_SPEED,
                shipMinX: SHIP_HALF_WIDTH,
                shipMaxX: SCREEN_WIDTH - SHIP_HALF_WIDTH,
            });

            const bindings: GameViewBindings = {
                getScreenWidth: () => SCREEN_WIDTH,
                getPlayHeight: () => PLAY_HEIGHT,
                getShipX: () => game.ship.x,
                getShipY: () => game.ship.y,
                isShipAlive: () => game.ship.alive,
                getEnemyCount: () => game.enemies.length,
                getEnemyX: (i) => game.enemies[i].x,
                getEnemyY: (i) => game.enemies[i].y,
                getEnemyKind: (i) => game.enemies[i].kind,
                getEnemyPhase: (i) => game.enemies[i].phase,
                isEnemyAlive: (i) => game.enemies[i].alive,
                getPlayerBulletCount: () => game.playerBullets.length,
                getPlayerBulletX: (i) => game.playerBullets[i].x,
                getPlayerBulletY: (i) => game.playerBullets[i].y,
                isPlayerBulletActive: (i) => game.playerBullets[i].active,
                getEnemyBulletCount: () => game.enemyBullets.length,
                getEnemyBulletX: (i) => game.enemyBullets[i].x,
                getEnemyBulletY: (i) => game.enemyBullets[i].y,
                isEnemyBulletActive: (i) => game.enemyBullets[i].active,
                getScore: () => game.score.score,
                getLives: () => game.score.lives,
                getStage: () => game.score.stage,
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
