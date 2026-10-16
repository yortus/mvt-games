/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface UfoViewBindings {
    screenX: () => number;
    screenY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A UFO. */
export function UfoView(bindings: UfoViewBindings): Container {
    return (
        <sprite
            texture={textures.get().ufo}
            anchor={0.5}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
