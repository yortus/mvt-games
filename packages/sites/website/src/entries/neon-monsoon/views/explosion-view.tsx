/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import type { ExplosionSize } from '../models';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplosionViewBindings {
    size: () => ExplosionSize;
    x: () => number;
    y: () => number;
    /** How far through the explosion it is, from 0 to 1. */
    progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An electric burst that grows and fades, in the neon's colours rather than
 * fire's, so it is never mistaken for a bullet. Drawn once, then scaled and
 * faded, so a frame writes numbers rather than redrawing graphics.
 */
export function ExplosionView(bindings: ExplosionViewBindings): Container {
    return (
        <graphics
            x={bindings.x}
            y={bindings.y}
            scale={() => (RADII[bindings.size()] / DRAWN_RADIUS) * (0.3 + 0.7 * bindings.progress())}
            alpha={() => 1 - bindings.progress()}
            ref={drawBurst}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The radius the burst is drawn at, before scaling. */
const DRAWN_RADIUS = 24;

/** World-units at full size. */
const RADII: Readonly<Record<ExplosionSize, number>> = {
    small: 12,
    large: 22,
    huge: 48,
};

function drawBurst(g: Graphics): void {
    g.circle(0, 0, DRAWN_RADIUS).fill({ color: NEON.violet, alpha: 0.5 });
    g.circle(0, 0, DRAWN_RADIUS * 0.6).fill({ color: NEON.cyan, alpha: 0.8 });
    g.circle(0, 0, DRAWN_RADIUS * 0.3).fill(0xffffff);
}
