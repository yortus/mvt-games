/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many corners an asteroid's outline has. */
const CORNERS = 11;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AsteroidShapeBindings {
    readonly x: () => number;
    readonly y: () => number;
    /** Picks the asteroid's lumpy outline. */
    readonly seed: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An asteroid, whose outline is worked out from its seed. Redrawing a
 * `Graphics` is costly, so the outline is redrawn only when the seed
 * changes. In a `<List>`, that's when a different asteroid arrives in the
 * slot, so the view always follows the asteroid that's there now.
 */
export function AsteroidShape(bindings: AsteroidShapeBindings): Container {
    let drawnSeed = -1; // the seed the outline was last drawn for

    return <graphics x={bindings.x} y={bindings.y} onRefresh={redrawOutlineWhenSeedChanges} />;

    function redrawOutlineWhenSeedChanges(g: Graphics): void {
        const seed = bindings.seed();
        if (seed === drawnSeed) return;
        drawnSeed = seed;
        drawAsteroid(g, seed);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Draws a lumpy outline, the same one every time for the same seed. */
function drawAsteroid(g: Graphics, seed: number): void {
    const points: number[] = [];
    for (let i = 0; i < CORNERS; i++) {
        const angle = (i / CORNERS) * Math.PI * 2;
        // A radius from 13 to 23, picked by the seed and the corner
        const radius = 13 + (Math.imul(seed + i * 7919, 2654435761) >>> 0) % 11;
        points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.clear().poly(points).fill(0x7a6650).stroke({ color: 0xb09a7a, width: 2 });
}
