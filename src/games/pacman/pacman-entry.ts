import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import {
    MAZE_DATA,
    TILE_SIZE,
    MAZE_ROWS,
    MAZE_COLS,
    PACMAN_SPAWN,
    GHOST_SPAWNS,
    GHOST_COLORS,
    HUD_HEIGHT,
    textures,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPacmanEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'pacman',
        name: 'Pac-Man',
        screenWidth: MAZE_COLS * TILE_SIZE,
        screenHeight: MAZE_ROWS * TILE_SIZE + HUD_HEIGHT,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('pacman: preload() must be called before start()');

            const gameModel = createGameModel({
                grid: MAZE_DATA,
                pacmanSpawn: PACMAN_SPAWN,
                ghostSpawns: GHOST_SPAWNS,
                ghostColors: GHOST_COLORS,
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
                inputConfig: {
                    showDpad: true,
                    onXDirectionChanged: (dir) => { if (dir !== 'none') gameModel.playerInput.direction = dir; },
                    onYDirectionChanged: (dir) => { if (dir !== 'none') gameModel.playerInput.direction = dir; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
