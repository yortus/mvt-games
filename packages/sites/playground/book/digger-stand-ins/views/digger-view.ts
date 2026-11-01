import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggerViewBindings {
    /** Where the digger is, in tiles, which may be fractional. */
    readonly row: () => number;
    readonly col: () => number;
    readonly direction: () => Direction;
    /** The width and height of one tile, in pixels. */
    readonly tileSize: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The digger: a round body with a drill on its nose, which points the way it's heading. */
export function DiggerView(bindings: DiggerViewBindings): Container {
    const { tileSize } = bindings;
    const view = new Container();

    // Drawn once, facing right. Each refresh moves and turns it.
    const radius = tileSize * 0.32;
    const body = new Graphics();
    body.moveTo(radius * 0.6, -radius * 0.55).lineTo(radius * 1.45, 0).lineTo(radius * 0.6, radius * 0.55).closePath().fill(0xd0d6e0);
    body.circle(0, 0, radius).fill(0xff9933);
    body.circle(radius * 0.25, -radius * 0.3, radius * 0.22).fill(0x1a1a1a);
    view.addChild(body);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.position.set((bindings.col() + 0.5) * tileSize, (bindings.row() + 0.5) * tileSize);
        body.rotation = ANGLES[bindings.direction()];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The drawing's rotation for each way the digger can head, in radians. A digger with no direction faces right. */
const ANGLES: Record<Direction, number> = {
    none: 0,
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
};
