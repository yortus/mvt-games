/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    screenX: () => number;
    screenY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** One of the ship's bullets. */
export function BulletView(bindings: BulletViewBindings): Container {
    return (
        <sprite
            texture={textures.get().bullet}
            anchor={0.5}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
