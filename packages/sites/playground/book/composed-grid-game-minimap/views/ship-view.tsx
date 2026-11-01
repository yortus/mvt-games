/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    /** Where the ship is, in cells. */
    readonly row: () => number;
    readonly col: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The player's ship, a little saucer, in the middle of its cell. */
export function ShipView(bindings: ShipViewBindings): Container {
    return (
        <graphics
            x={() => (bindings.col() + 0.5) * TILE_SIZE}
            y={() => (bindings.row() + 0.5) * TILE_SIZE}
            ref={drawSaucer}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawSaucer(g: Graphics): void {
    g.ellipse(0, -3, 6, 6).fill(0x9fe8ff);
    g.ellipse(0, 2, 12, 5).fill(0x7fe07f).stroke({ color: 0xd8ffd8, width: 1.5 });
}
