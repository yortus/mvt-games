/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import { isTouchDevice, OverlayView, SwipeInputView } from '#shared';
import { COLS, ROWS } from '../data';
import type { GameModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Pixels per cell, the height of the score bar, and the screen's size in pixels. */
export const CELL = 16;
export const HUD_HEIGHT = 24;
export const SCREEN_WIDTH = COLS * CELL;
export const SCREEN_HEIGHT = ROWS * CELL + HUD_HEIGHT;

/** The whole game: the score bar, the garden, the berry, the snake, and the game-over panel. */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const scoreText = createComputed({ watch: () => model.score, compute: (score) => `SCORE ${score}` });
    const isTouch = isTouchDevice();
    const gameOverText = `GAME OVER\n\n${isTouch ? 'Tap' : 'Press Enter'} to play again`;

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
                onSwiped={(direction) => { model.direction = direction; }}
            />
            <text text={scoreText} x={8} y={5} style={HUD_STYLE} />
            <container y={HUD_HEIGHT}>
                <graphics ref={drawGarden} />
                <graphics x={() => (model.berry.col + 0.5) * CELL} y={() => (model.berry.row + 0.5) * CELL} ref={drawBerry} />
                <List items={{ length: () => model.length, at: (i) => i }}>
                    {(index) => (
                        <graphics
                            x={() => model.colAt(index()) * CELL}
                            y={() => model.rowAt(index()) * CELL}
                            tint={index() === 0 ? HEAD_COLOR : BODY_COLOR}
                            ref={(g) => g.roundRect(1, 1, CELL - 2, CELL - 2, 4).fill(0xffffff)}
                        />
                    )}
                </List>
            </container>
            <OverlayView
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                isVisible={() => model.phase === 'game-over'}
                text={() => gameOverText}
                onPressed={model.startNewRun}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a finger slides to steer, in pixels. */
const SWIPE_DISTANCE = 14;
/** The snake's segments are white rounded squares, tinted. */
const HEAD_COLOR = 0xd8f26a;
const BODY_COLOR = 0x6fbf3f;
const HUD_STYLE = { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace' };

/** A checked lawn, one square a cell. */
function drawGarden(g: Graphics): void {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            g.rect(col * CELL, row * CELL, CELL, CELL).fill((row + col) % 2 === 0 ? 0x2d4a2b : 0x284326);
        }
    }
}

/** A red berry with a leaf, centred on the origin. */
function drawBerry(g: Graphics): void {
    g.circle(0, 1, CELL * 0.35).fill(0xe0414f);
    g.ellipse(2, -5, 3, 1.5).fill(0x8fd16a);
}
