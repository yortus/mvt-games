/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BombFlashViewBindings {
    isBombing: () => boolean;
    /** Milliseconds since the bomb went off. */
    elapsedMs: () => number;
    /** Where the shockwave spreads from. */
    x: () => number;
    y: () => number;
    /** The flash's size, read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A bomb going off: a white flash over the arena, and a ring spreading out
 * from the ship. No state of its own: both follow the model's bomb timer.
 */
export function BombFlashView(bindings: BombFlashViewBindings): Container {
    const { width, height } = bindings;
    return (
        <container visible={bindings.isBombing}>
            <graphics
                ref={(g) => g.rect(0, 0, width, height).fill(0xffffff)}
                alpha={() => Math.max(0, 0.75 * (1 - bindings.elapsedMs() / FLASH_MS))}
            />
            <graphics
                x={bindings.x}
                y={bindings.y}
                ref={drawRing}
                scale={() => (bindings.elapsedMs() / RING_MS) * (RING_RADIUS / DRAWN_RADIUS)}
                alpha={() => Math.max(0, 1 - bindings.elapsedMs() / RING_MS)}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLASH_MS = 350;
const RING_MS = 700;
const RING_RADIUS = 260;

/** The radius the ring is drawn at, before it is scaled up as it spreads. */
const DRAWN_RADIUS = 100;

function drawRing(g: Graphics): void {
    g.circle(0, 0, DRAWN_RADIUS).stroke({ color: 0xbfe9ff, width: 2 });
}
