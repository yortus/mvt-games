import { Container } from 'pixi.js';
import { createKeyboardInputView, createOverlayView, watch } from '#common';
import type { GameModel } from '../models';
import { TILE_SIZE, MAZE_ROWS, MAZE_COLS } from '../data';
import { createMazeView } from './maze-view';
import { createPacmanView, type PacmanViewTextures } from './pacman-view';
import { createGhostView, type GhostViewTextures } from './ghost-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface GameViewTextures {
    readonly pacman: PacmanViewTextures;
    readonly ghost: GhostViewTextures;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel, textures: GameViewTextures): Container {
    // ---- Change detection ---------------------------------------------------
    const watcher = watch({
        ghostCount: () => game.ghosts.length,
    });

    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;

    // ---- Scene elements -------------------------------------------------------
    const view = new Container();

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
    }, textures.pacman);
    view.addChild(pacmanContainer);

    // Ghosts - managed as a dynamic list
    let ghostContainers: Container[] = [];
    buildGhosts();

    // HUD - positioned below the maze
    const hudContainer = createHudView({
        getScore: () => game.score.score,
    });
    hudContainer.position.set(0, canvasH);
    view.addChild(hudContainer);

    // Overlay
    const overlayView = createOverlayView({
        getWidth: () => canvasW,
        getHeight: () => canvasH,
        isVisible: () => game.phase !== 'playing',
        getText: () => game.phase === 'game-over'
            ? 'GAME OVER\n\nPress Enter to restart'
            : 'YOU WIN!\n\nPress Enter to restart',
    });
    view.addChild(overlayView);

    // ---- Player input --------------------------------------------------------
    view.addChild(createKeyboardInputView({
        onXDirectionChanged: (dir) => { if (dir !== 'none') game.playerInput.direction = dir; },
        onYDirectionChanged: (dir) => { if (dir !== 'none') game.playerInput.direction = dir; },
        onRestartButtonChanged: (pressed) => { game.playerInput.restartPressed = pressed; },
    }));

    view.onRender = refresh;
    return view;

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
                getColor: () => game.ghosts[idx].color,
                getTileSize: () => TILE_SIZE,
            }, textures.ghost);
            view.addChild(ghostContainer);
            ghostContainers.push(ghostContainer);
        }
    }
}
