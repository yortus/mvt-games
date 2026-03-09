import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView, type GameViewBindings } from './views';
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
    return {
        id: 'pacman',
        name: 'Pac-Man',
        screenWidth: MAZE_COLS * TILE_SIZE,
        screenHeight: MAZE_ROWS * TILE_SIZE + HUD_HEIGHT,

        start(stage: Container): GameSession {
            const game = createGameModel({
                grid: MAZE_DATA,
                pacmanSpawn: PACMAN_SPAWN,
                ghostSpawns: GHOST_SPAWNS,
                ghostColors: GHOST_COLORS,
            });

            const bindings: GameViewBindings = {
                getTileSize: () => TILE_SIZE,
                getRows: () => MAZE_ROWS,
                getCols: () => MAZE_COLS,
                getTileKind: (r, c) => game.maze.tileAt(r, c),
                isDotAt: (r, c) => game.maze.isDot(r, c),
                getPacmanX: () => game.pacman.x,
                getPacmanY: () => game.pacman.y,
                getPacmanDirection: () => game.pacman.direction,
                getPacmanStepProgress: () => game.pacman.stepProgress,
                getGhostCount: () => game.ghosts.length,
                getGhostX: (i) => game.ghosts[i].x,
                getGhostY: (i) => game.ghosts[i].y,
                getGhostColor: (i) => game.ghosts[i].color,
                getScore: () => game.score.score,
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
