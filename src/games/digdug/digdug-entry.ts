import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { loadSpriteTextures, type SpriteTextures } from '#utils';
import { createGameModel } from './models';
import { createGameView, type GameViewBindings, type GameViewTextures } from './views';
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
    let textures: SpriteTextures | undefined;

    return {
        id: 'digdug',
        name: 'Dig Dug',
        screenWidth: FIELD_COLS * TILE_SIZE,
        screenHeight: FIELD_ROWS * TILE_SIZE + HUD_HEIGHT,

        async preload(): Promise<void> {
            textures = await loadSpriteTextures('/sprites/digdug-sprites.json');
        },

        start(stage: Container): GameSession {
            if (!textures) throw new Error('digdug: preload() must be called before start()');

            const game = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const gameTextures: GameViewTextures = {
                digger: {
                    idle: textures['digger-idle'],
                    walkA: textures['digger-walk-a'],
                    walkB: textures['digger-walk-b'],
                    pump: textures['digger-pump'],
                },
                enemy: {
                    pooka: textures['pooka'],
                    'pooka-inflate1': textures['pooka-inflate1'],
                    'pooka-inflate2': textures['pooka-inflate2'],
                    'pooka-inflate3': textures['pooka-inflate3'],
                    'pooka-crushed': textures['pooka-crushed'],
                    fygar: textures['fygar'],
                    'fygar-inflate1': textures['fygar-inflate1'],
                    'fygar-inflate2': textures['fygar-inflate2'],
                    'fygar-inflate3': textures['fygar-inflate3'],
                    'fygar-crushed': textures['fygar-crushed'],
                    'ghost-eyes': textures['ghost-eyes'],
                },
                rock: {
                    rock: textures['rock'],
                    shattered: textures['rock-shattered'],
                },
                diggerIcon: textures['digger-icon'],
            };

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

            const gameContainer = createGameView(bindings, gameTextures);
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
