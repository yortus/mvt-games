import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { loadSpriteTextures, type SpriteTextures } from '#utils';
import { createGameModel } from './models';
import { createGameView, type GameViewTextures } from './views';
import {
    MAZE_DATA,
    TILE_SIZE,
    MAZE_ROWS,
    MAZE_COLS,
    PACMAN_SPAWN,
    GHOST_SPAWNS,
    GHOST_COLORS,
    HUD_HEIGHT,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPacmanEntry(): GameEntry {
    let textures: SpriteTextures | undefined;

    return {
        id: 'pacman',
        name: 'Pac-Man',
        screenWidth: MAZE_COLS * TILE_SIZE,
        screenHeight: MAZE_ROWS * TILE_SIZE + HUD_HEIGHT,

        async preload(): Promise<void> {
            textures = await loadSpriteTextures('sprites/pacman-sprites.json');
        },

        start(stage: Container): GameSession {
            if (!textures) throw new Error('pacman: preload() must be called before start()');

            const gameModel = createGameModel({
                grid: MAZE_DATA,
                pacmanSpawn: PACMAN_SPAWN,
                ghostSpawns: GHOST_SPAWNS,
                ghostColors: GHOST_COLORS,
            });

            const gameTextures: GameViewTextures = {
                pacman: {
                    closed: textures['pacman-closed'],
                    mid: textures['pacman-mid'],
                    open: textures['pacman-open'],
                },
                ghost: {
                    body: textures['ghost-body'],
                    eyes: textures['ghost-eyes'],
                },
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
