import { Container, Graphics, Text } from 'pixi.js';
import { createWatcher } from '#utils';
import type { GameModel } from '../models';
import { TILE_SIZE, MAZE_ROWS, MAZE_COLS } from '../data';
import { createKeyboardPlayerInputView } from './keyboard-player-input-view';
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
    const watched = createWatcher({
        ghostCount: () => game.ghosts.length,
        phase: () => game.phase,
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

    // Ghosts — managed as a dynamic list
    let ghostContainers: Container[] = [];
    buildGhosts();

    // HUD — positioned below the maze
    const hudContainer = createHudView({
        getScore: () => game.score.score,
    });
    hudContainer.position.set(0, canvasH);
    view.addChild(hudContainer);

    // Overlay (game over / win)
    const overlay = new Container();
    overlay.visible = false;

    const overlayBg = new Graphics();
    overlayBg.rect(0, 0, canvasW, canvasH).fill({ color: 0x000000, alpha: 0.6 });
    overlay.addChild(overlayBg);

    const overlayText = new Text({
        text: '',
        style: {
            fontFamily: 'monospace',
            fontSize: 28,
            fill: 0xffffff,
            align: 'center',
        },
    });
    overlayText.anchor.set(0.5);
    overlayText.position.set(canvasW / 2, canvasH / 2);
    overlay.addChild(overlayText);
    view.addChild(overlay);

    // ---- Player input --------------------------------------------------------
    view.addChild(createKeyboardPlayerInputView({
        onDirectionChange: (dir) => { game.playerInput.direction = dir; },
        onRestartChange: (pressed) => { game.playerInput.restartPressed = pressed; },
    }));

    view.onRender = refresh;
    return view;

    function refresh(): void {
        watched.poll();

        if (watched.ghostCount.changed) buildGhosts();

        if (watched.phase.changed) {
            if (watched.phase.value === 'playing') {
                overlay.visible = false;
            } else {
                overlay.visible = true;
                overlayText.text =
                    watched.phase.value === 'game-over'
                        ? 'GAME OVER\n\nPress Enter to restart'
                        : 'YOU WIN!\n\nPress Enter to restart';
            }
        }
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
