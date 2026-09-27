import { Container } from 'pixi.js';
import { OverlayView, isTouchDevice, watch } from '#common';
import type { GameModel } from '../models';
import { MAZE_ROWS, MAZE_COLS } from '../data';
import { TILE_SIZE, GHOST_COLORS } from './view-constants';
import { MazeView } from './maze-view';
import { PacmanView } from './pacman-view';
import { GhostView } from './ghost-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function GameView(bindings: GameViewBindings): Container {
    const game = bindings.model;
    const watcher = watch({
        ghostCount: () => game.ghosts.length,
    });
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    let ghostContainers: Container[] = [];

    const view = new Container();
    initialiseView();
    buildGhosts();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        // Maze
        const mazeContainer = MazeView({
            tileSize: () => TILE_SIZE,
            rows: () => MAZE_ROWS,
            cols: () => MAZE_COLS,
            tileKindAt: (r, c) => game.maze.tileAt(r, c),
            isDotAt: (r, c) => game.maze.isDot(r, c),
            gamePhase: () => game.phase,
        });
        view.addChild(mazeContainer);

        // Pac-Man
        const pacmanContainer = PacmanView({
            row: () => game.pacman.row,
            col: () => game.pacman.col,
            direction: () => game.pacman.direction,
            tileSize: () => TILE_SIZE,
        });
        view.addChild(pacmanContainer);

        // HUD - positioned below the maze
        const hudContainer = HudView({
            score: () => game.score,
        });
        hudContainer.position.set(0, canvasH);
        view.addChild(hudContainer);

        // Overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        const overlayView = OverlayView({
            width: canvasW,
            height: canvasH,
            isVisible: () => game.phase !== 'playing',
            text: () =>
                game.phase === 'game-over'
                    ? `GAME OVER\n\n${restartHint}`
                    : `YOU WIN!\n\n${restartHint}`,
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
            const ghostContainer = GhostView({
                row: () => game.ghosts[idx].row,
                col: () => game.ghosts[idx].col,
                color: () => GHOST_COLORS[idx] ?? 0xff0000,
                tileSize: () => TILE_SIZE,
            });
            view.addChild(ghostContainer);
            ghostContainers.push(ghostContainer);
        }
    }
}
