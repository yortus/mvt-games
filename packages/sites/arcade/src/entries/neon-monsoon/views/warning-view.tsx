/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { HUD_FONT, NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WarningViewBindings {
    /** Milliseconds the warning has been up, or -1 while it is not. */
    elapsedMs: () => number;
    /** The screen's size, which places the banner, so read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The pulsing banner before the boss. Its pulse follows the model's warning timer. */
export function WarningView(bindings: WarningViewBindings): Container {
    const { width, height } = bindings;
    return (
        <container
            y={height / 2 - BANNER_HEIGHT / 2}
            visible={() => bindings.elapsedMs() >= 0}
            alpha={() => 0.55 + 0.45 * Math.cos(bindings.elapsedMs() * PULSE_RATE)}
        >
            <graphics ref={(g) => drawBanner(g, width)} />
            <text text="WARNING" x={width / 2} y={BANNER_HEIGHT / 2 - 7} anchor={0.5} style={TITLE_STYLE} />
            <text
                text="THE STORMCORE APPROACHES"
                x={width / 2}
                y={BANNER_HEIGHT / 2 + 9}
                anchor={0.5}
                style={SUBTITLE_STYLE}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BANNER_HEIGHT = 44;
const PULSE_RATE = 0.008;

const TITLE_STYLE = { fontFamily: HUD_FONT, fontSize: 18, fontWeight: 'bold' as const, fill: NEON.magenta, letterSpacing: 4 };
const SUBTITLE_STYLE = { fontFamily: HUD_FONT, fontSize: 9, fill: 0xffd1e8 };

function drawBanner(g: Graphics, width: number): void {
    g.rect(0, 0, width, BANNER_HEIGHT).fill({ color: 0x1a0612, alpha: 0.7 });
    g.rect(0, 0, width, 2).fill(NEON.magenta);
    g.rect(0, BANNER_HEIGHT - 2, width, 2).fill(NEON.magenta);
}
