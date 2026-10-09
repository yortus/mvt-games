/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import { List } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import type { GameModel } from '../models';
import { MAZE_ROWS, MAZE_COLS } from '../data';
import { TILE_SIZE, CAT_COLORS } from './view-constants';
import { MazeView } from './maze-view';
import { MouseView } from './mouse-view';
import { CatView } from './cat-view';
import { HudView } from './hud-view';
import { GameAudioView } from './game-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    /** The game to draw and play the sounds of. */
    model: GameModel;
    /** The chip the game's sounds play on. It is the view's output, not model state, so the view reads it once. */
    sound: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game: the maze and the mouse, the HUD below, the overlay, and the
 * cats, drawn last (so above the overlay, as they always have been). The
 * cats are a `<List>`; each takes its color from its index. Its audio view,
 * which draws nothing, plays the music and the nibbles.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sound } = bindings;
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;
    const winText = `YOU WIN!\n\n${restartHint}`;

    return (
        <container>
            <GameAudioView
                sound={sound}
                phase={() => model.phase}
                remainingCrumbs={() => model.maze.remainingCrumbs}
                totalCrumbs={model.maze.totalCrumbs}
            />
            <MazeView
                tileSize={() => TILE_SIZE}
                rows={() => MAZE_ROWS}
                cols={() => MAZE_COLS}
                tileKindAt={(r, c) => model.maze.tileAt(r, c)}
                isCrumbAt={(r, c) => model.maze.isCrumb(r, c)}
                gamePhase={() => model.phase}
            />
            <MouseView
                row={() => model.mouse.row}
                col={() => model.mouse.col}
                direction={() => model.mouse.direction}
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
            <List items={() => model.cats}>
                {(cat, index) => (
                    <CatView
                        row={() => cat().row}
                        col={() => cat().col}
                        direction={() => cat().direction}
                        color={() => CAT_COLORS[index] ?? CAT_COLORS[0]}
                        tileSize={() => TILE_SIZE}
                    />
                )}
            </List>
        </container>
    );
}
