import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';
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
    const watchGhostCount = createWatch(() => game.ghosts.length);
    const watchPhase = createWatch(() => game.phase);

    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;

    // ---- Scene elements -------------------------------------------------------
    const container = new Container();

    // Maze
    const mazeContainer = createMazeView({
        getTileSize: () => TILE_SIZE,
        getRows: () => MAZE_ROWS,
        getCols: () => MAZE_COLS,
        getTileKind: (r, c) => game.maze.tileAt(r, c),
        isDotAt: (r, c) => game.maze.isDot(r, c),
        getGamePhase: () => game.phase,
    });
    container.addChild(mazeContainer);

    // Pac-Man
    const pacmanContainer = createPacmanView({
        getX: () => game.pacman.x,
        getY: () => game.pacman.y,
        getDirection: () => game.pacman.direction,
        getStepProgress: () => game.pacman.stepProgress,
        getTileSize: () => TILE_SIZE,
    }, textures.pacman);
    container.addChild(pacmanContainer);

    // Ghosts — managed as a dynamic list
    let ghostContainers: Container[] = [];
    buildGhosts();

    // HUD — positioned below the maze
    const hudContainer = createHudView({
        getScore: () => game.score.score,
    });
    hudContainer.position.set(0, canvasH);
    container.addChild(hudContainer);

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
    container.addChild(overlay);

    // ---- Player input --------------------------------------------------------
    container.addChild(createKeyboardPlayerInputView({
        onDirectionChange: (dir) => { game.playerInput.direction = dir; },
        onRestartRequest: () => { game.playerInput.restartRequested = true; },
    }));

    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchGhostCount.changed()) buildGhosts();

        if (watchPhase.changed()) {
            const phase = watchPhase.value;
            if (phase === 'playing') {
                overlay.visible = false;
            } else {
                overlay.visible = true;
                overlayText.text =
                    phase === 'game-over'
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
                getX: () => game.ghosts[idx].x,
                getY: () => game.ghosts[idx].y,
                getColor: () => game.ghosts[idx].color,
                getTileSize: () => TILE_SIZE,
            }, textures.ghost);
            container.addChild(ghostContainer);
            ghostContainers.push(ghostContainer);
        }
    }
}
