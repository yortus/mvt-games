import { Application } from 'pixi.js';
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

async function main(): Promise<void> {
    // ---- Pixi application --------------------------------------------------
    const app = new Application();
    await app.init({
        width: MAZE_COLS * TILE_SIZE,
        height: MAZE_ROWS * TILE_SIZE + HUD_HEIGHT,
        backgroundColor: 0x000000,
        antialias: true,
    });
    document.body.appendChild(app.canvas);

    // ---- Model -------------------------------------------------------------
    const game = createGameModel({
        grid: MAZE_DATA,
        pacmanSpawn: PACMAN_SPAWN,
        ghostSpawns: GHOST_SPAWNS,
        ghostColors: GHOST_COLORS,
    });

    // ---- Bindings (Model → View bridge) ------------------------------------
    const bindings: GameViewBindings = {
        // Maze
        getTileSize: () => TILE_SIZE,
        getRows: () => MAZE_ROWS,
        getCols: () => MAZE_COLS,
        getTileKind: (r, c) => game.maze.tileAt(r, c),
        isDotAt: (r, c) => game.maze.isDot(r, c),
        // Pac-Man
        getPacmanX: () => game.pacman.x,
        getPacmanY: () => game.pacman.y,
        getPacmanDirection: () => game.pacman.direction,
        getPacmanStepProgress: () => game.pacman.stepProgress,
        // Ghosts
        getGhostCount: () => game.ghosts.length,
        getGhostX: (i) => game.ghosts[i].x,
        getGhostY: (i) => game.ghosts[i].y,
        getGhostColor: (i) => game.ghosts[i].color,
        // HUD
        getScore: () => game.score.score,
        // State
        getGamePhase: () => game.phase,
        // Player input
        getPlayerInput: () => game.playerInput,
    };

    // ---- View --------------------------------------------------------------
    const gameContainer = createGameView(bindings);
    app.stage.addChild(gameContainer);

    // ---- Ticker (model-only) -----------------------------------------------
    app.ticker.add((ticker) => {
        game.update(ticker.deltaMS);
    });
}

main();
