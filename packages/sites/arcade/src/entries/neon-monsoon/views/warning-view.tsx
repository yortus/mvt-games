/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { PixelTextView } from '#shared';
import { NEON } from './view-constants';

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
            <container x={width / 2} y={BANNER_HEIGHT / 2 - 7}>
                <PixelTextView text="WARNING" color={NEON.magenta} scale={2} anchorX={0.5} anchorY={0.5} />
            </container>
            <container x={width / 2} y={BANNER_HEIGHT / 2 + 9}>
                <PixelTextView text="THE STORMCORE APPROACHES" color={SUBTITLE_COLOR} anchorX={0.5} anchorY={0.5} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BANNER_HEIGHT = 44;
const PULSE_RATE = 0.008;

/** The line under the title. The title is set in the pixel glyphs at twice their size, the line at their own. */
const SUBTITLE_COLOR = 0xffd1e8;

function drawBanner(g: Graphics, width: number): void {
    g.rect(0, 0, width, BANNER_HEIGHT).fill({ color: 0x1a0612, alpha: 0.7 });
    g.rect(0, 0, width, 2).fill(NEON.magenta);
    g.rect(0, BANNER_HEIGHT - 2, width, 2).fill(NEON.magenta);
}
