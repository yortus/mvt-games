/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    /** Where the ship is across, read once. */
    readonly x: number;
    readonly y: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The ship, pointing right. */
export function ShipView(bindings: ShipViewBindings): Container {
    return <graphics x={bindings.x} y={bindings.y} ref={drawShip} />;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawShip(g: Graphics): void {
    g.poly([16, 0, -12, -12, -6, 0, -12, 12]).fill(0x9fe8ff).stroke({ color: 0xdff6ff, width: 2 });
}
