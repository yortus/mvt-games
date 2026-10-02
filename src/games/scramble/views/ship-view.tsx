/** @jsxImportSource @mvtjs/pixi/jsx */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    screenX: () => number;
    screenY: () => number;
    isAlive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The player's ship, hidden while it is not alive. */
export function ShipView(bindings: ShipViewBindings): Container {
    return (
        <sprite
            texture={textures.get().ship.sprite}
            anchor={0.5}
            visible={bindings.isAlive}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
