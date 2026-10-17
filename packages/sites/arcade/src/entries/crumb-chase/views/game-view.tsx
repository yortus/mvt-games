/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { isTouchDevice, OverlayView, SwipeInputView } from '#shared';
import { List } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import type { GameModel } from '../models';
import { MAZE_ROWS, MAZE_COLS } from '../data';
import { TILE_SIZE, CAT_COLORS, SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';
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
 * cats are a `<List>`; each takes its color from its index. Its audio view
 * plays the music and the nibbles. On a touch screen, a swipe anywhere on
 * the screen steers the mouse, as an arrow key does: it turns that way at
 * the next corner that opens that way. The overlay's own taps come first.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sound } = bindings;
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    const isTouch = isTouchDevice();
    const restartHint = isTouch ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;
    const winText = `YOU WIN!\n\n${restartHint}`;

    return (
        <container>
            {/* Behind everything, so the overlay takes its own taps; it reaches past the screen, to the space round it */}
            <SwipeInputView
                isEnabled={isTouch}
                x={-SCREEN_WIDTH * 2}
                y={-SCREEN_HEIGHT}
                width={SCREEN_WIDTH * 5}
                height={SCREEN_HEIGHT * 4}
                swipeDistance={SWIPE_DISTANCE}
                onSwiped={(direction) => { model.playerInput.direction = direction; }}
            />
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
                <HudView score={() => model.score} hint={isTouch ? 'Swipe to steer' : ''} width={canvasW} />
            </container>
            <OverlayView
                font="pixel"
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a finger must slide to swipe, in the game's pixels: most of a tile. */
const SWIPE_DISTANCE = 14;
