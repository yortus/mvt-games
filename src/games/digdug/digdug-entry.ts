import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, type GameViewBindings } from './views';
import {
    TILE_SIZE,
    FIELD_ROWS,
    FIELD_COLS,
    HUD_HEIGHT,
    BASE_FIELD,
    DEPTH_LAYERS,
    DIGGER_SPAWN,
    LEVELS,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDigdugEntry(): GameEntry {
    return {
        id: 'digdug',
        name: 'Dig Dug',
        screenWidth: FIELD_COLS * TILE_SIZE,
        screenHeight: FIELD_ROWS * TILE_SIZE + HUD_HEIGHT,

        start(stage: Container): GameSession {
            const game = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const bindings: GameViewBindings = {
                getTileSize: () => TILE_SIZE,
                getRows: () => FIELD_ROWS,
                getCols: () => FIELD_COLS,
                getTileKind: (r, c) => game.field.tileAt(r, c),
                getDepthLayers: () => DEPTH_LAYERS,
                getTunnelCount: () => game.field.tunnelCount,
                getDiggerX: () => game.digger.x,
                getDiggerY: () => game.digger.y,
                getDiggerDirection: () => game.digger.direction,
                getDiggerStepProgress: () => game.digger.stepProgress,
                isDiggerAlive: () => game.digger.alive,
                isHarpoonExtended: () => game.digger.harpoonExtended,
                getHarpoonDistance: () => game.digger.harpoonDistance,
                getEnemyCount: () => game.enemies.length,
                getEnemyX: (i) => game.enemies[i].x,
                getEnemyY: (i) => game.enemies[i].y,
                getEnemyKind: (i) => game.enemies[i].kind,
                getEnemyPhase: (i) => game.enemies[i].phase,
                getInflationStage: (i) => game.enemies[i].inflationStage,
                getEnemyDirection: (i) => game.enemies[i].direction,
                isEnemyFireActive: (i) => game.enemies[i].fireActive,
                isEnemyFireTelegraph: (i) => game.enemies[i].fireTelegraph,
                getRockCount: () => game.rocks.length,
                getRockX: (i) => game.rocks[i].x,
                getRockY: (i) => game.rocks[i].y,
                getRockPhase: (i) => game.rocks[i].phase,
                isRockAlive: (i) => game.rocks[i].alive,
                getScore: () => game.score.score,
                getLives: () => game.score.lives,
                getLevel: () => game.score.level,
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
