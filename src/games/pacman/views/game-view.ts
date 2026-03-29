import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice, watch } from '#common';
import type { GameModel } from '../models';
import { MAZE_ROWS, MAZE_COLS } from '../data';
import { TILE_SIZE, GHOST_COLORS } from './view-constants';
import { createMazeView } from './maze-view';
import { createPacmanView } from './pacman-view';
import { createGhostView } from './ghost-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const watcher = watch({
        ghostCount: () => game.ghosts.length,
    });
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    let ghostContainers: Container[] = [];

    const view = new Container();
    initialiseView();
    buildGhosts();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        // Maze
        const mazeContainer = createMazeView({
            getTileSize: () => TILE_SIZE,
            getRows: () => MAZE_ROWS,
            getCols: () => MAZE_COLS,
            getTileKind: (r, c) => game.maze.tileAt(r, c),
            isDotAt: (r, c) => game.maze.isDot(r, c),
            getGamePhase: () => game.phase,
        });
        view.addChild(mazeContainer);

        // Pac-Man
        const pacmanContainer = createPacmanView({
            getRow: () => game.pacman.row,
            getCol: () => game.pacman.col,
            getDirection: () => game.pacman.direction,
            getTileSize: () => TILE_SIZE,
        });
        view.addChild(pacmanContainer);

        // HUD - positioned below the maze
        const hudContainer = createHudView({
            getScore: () => game.score,
        });
        hudContainer.position.set(0, canvasH);
        view.addChild(hudContainer);

        // Overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        const overlayView = createOverlayView({
            getWidth: () => canvasW,
            getHeight: () => canvasH,
            getVisible: () => game.phase !== 'playing',
            getText: () =>
                game.phase === 'game-over' ?
                    `GAME OVER\n\n${restartHint}` :
                    `YOU WIN!\n\n${restartHint}`,
            onRestartPressed: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        });
        view.addChild(overlayView);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.ghostCount.changed) buildGhosts();
    }

    function buildGhosts(): void {
        for (let i = 0; i < ghostContainers.length; i++) {
            ghostContainers[i].destroy();
        }
        ghostContainers = [];

        const count = game.ghosts.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const ghostContainer = createGhostView({
                getRow: () => game.ghosts[idx].row,
                getCol: () => game.ghosts[idx].col,
                getColor: () => GHOST_COLORS[idx] ?? 0xff0000,
                getTileSize: () => TILE_SIZE,
            });
            view.addChild(ghostContainer);
            ghostContainers.push(ghostContainer);
        }
    }
}
