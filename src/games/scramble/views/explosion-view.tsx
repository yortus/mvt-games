/** @jsxImportSource @mvtjs/pixi/jsx */

import type { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplosionViewBindings {
    screenX: () => number;
    screenY: () => number;
    /** How far through the explosion it is, from 0 to 1. */
    progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A burst that grows and fades as the explosion runs. Drawn once at full
 * size, then scaled and faded, so a frame writes two numbers rather than
 * redrawing the graphics.
 */
export function ExplosionView(bindings: ExplosionViewBindings): Container {
    return (
        <graphics
            x={bindings.screenX}
            y={bindings.screenY}
            scale={bindings.progress}
            alpha={() => 1 - bindings.progress()}
            ref={drawBurst}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_RADIUS = TILE_SIZE * 0.8;

function drawBurst(g: Graphics): void {
    // Outer burst - orange/yellow
    g.circle(0, 0, MAX_RADIUS).fill({ color: 0xff8800, alpha: 0.6 });
    // Inner core - white/yellow
    g.circle(0, 0, MAX_RADIUS * 0.5).fill({ color: 0xffff00 });
}
