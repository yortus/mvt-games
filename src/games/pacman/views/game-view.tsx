/** @jsxImportSource @mvtjs/pixi/jsx */

import type { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#common';
import { List } from '@mvtjs/pixi/jsx';
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

/**
 * The whole game: the maze and Pac-Man, the HUD below, the overlay, and the
 * ghosts, drawn last (so above the overlay, as they always have been). The
 * ghosts are a `<List>`; each takes its color from its index.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;
    const winText = `YOU WIN!\n\n${restartHint}`;

    return (
        <container>
            <MazeView
                tileSize={() => TILE_SIZE}
                rows={() => MAZE_ROWS}
                cols={() => MAZE_COLS}
                tileKindAt={(r, c) => model.maze.tileAt(r, c)}
                isDotAt={(r, c) => model.maze.isDot(r, c)}
                gamePhase={() => model.phase}
            />
            <PacmanView
                row={() => model.pacman.row}
                col={() => model.pacman.col}
                direction={() => model.pacman.direction}
                tileSize={() => TILE_SIZE}
            />
            <container y={canvasH}>
                <HudView score={() => model.score} />
            </container>
            <OverlayView
                width={canvasW}
                height={canvasH}
                isVisible={() => model.phase !== 'playing'}
                text={() => (model.phase === 'game-over' ? gameOverText : winText)}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />
            <List items={() => model.ghosts}>
                {(ghost, index) => (
                    <GhostView
                        row={() => ghost().row}
                        col={() => ghost().col}
                        color={() => GHOST_COLORS[index] ?? 0xff0000}
                        tileSize={() => TILE_SIZE}
                    />
                )}
            </List>
        </container>
    );
}
