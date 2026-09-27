/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BombViewBindings {
    screenX: () => number;
    screenY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** One of the ship's bombs. */
export function BombView(bindings: BombViewBindings): Container {
    return (
        <sprite
            texture={textures.get().bomb}
            anchor={0.5}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
