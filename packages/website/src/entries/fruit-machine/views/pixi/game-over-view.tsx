/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics } from 'pixi.js';
import { ROW_COUNT } from '../../data';
import { CELL_SIZE, DIM, FONT_FAMILY, METER_VALUE, WHITE, WINDOW_WIDTH, WINDOW_X, WINDOW_Y } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameOverViewBindings {
    readonly isShown: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** "GAME OVER" across the window once the credits run out. */
export function GameOverView(bindings: GameOverViewBindings): Container {
    return (
        <container visible={bindings.isShown}>
            <graphics ref={drawShade} alpha={0.82} />
            <text text="GAME OVER" x={WINDOW_X + WINDOW_WIDTH / 2} y={WINDOW_Y + HEIGHT / 2 - 14} anchor={0.5} style={TITLE_STYLE} />
            <text
                text="Out of credits. Reload to play again."
                x={WINDOW_X + WINDOW_WIDTH / 2}
                y={WINDOW_Y + HEIGHT / 2 + 30}
                anchor={0.5}
                style={NOTE_STYLE}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEIGHT = ROW_COUNT * CELL_SIZE;
const TITLE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 52, fontWeight: '900', letterSpacing: 6, fill: METER_VALUE };
const NOTE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: '700', fill: WHITE };

function drawShade(g: Graphics): void {
    g.roundRect(WINDOW_X, WINDOW_Y, WINDOW_WIDTH, HEIGHT, 12).fill(DIM);
}
