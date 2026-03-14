import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { loadSpriteTextures, type SpriteTextures } from '#common';
import { createGameModel } from './models';
import { createGameView, type GameViewTextures } from './views';
import {
    TILE_SIZE,
    FIELD_ROWS,
    FIELD_COLS,
    HUD_HEIGHT,
    BASE_FIELD,
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
            textures = await loadSpriteTextures('sprites/digdug-sprites.json');
        },

        start(stage: Container): GameSession {
            if (!textures) throw new Error('digdug: preload() must be called before start()');

            const gameModel = createGameModel({
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
