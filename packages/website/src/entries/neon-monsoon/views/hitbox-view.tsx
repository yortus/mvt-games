/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HitboxViewBindings {
    x: () => number;
    y: () => number;
    isShown: () => boolean;
    /** The hitbox's radius in world-units, read once. */
    radius: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship's true hitbox: a white dot in a cyan ring, a colour no bullet has. Drawn above the enemy
 * bullets while focusing, so the player can see exactly what must not touch
 * them.
 */
export function HitboxView(bindings: HitboxViewBindings): Container {
    const { radius } = bindings;
    return (
        <graphics
            x={bindings.x}
            y={bindings.y}
            visible={bindings.isShown}
            ref={(g) => drawHitbox(g, radius)}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawHitbox(g: Graphics, radius: number): void {
    g.circle(0, 0, radius + 2).stroke({ color: NEON.cyan, width: 1 });
    g.circle(0, 0, radius).fill(0xffffff);
}
