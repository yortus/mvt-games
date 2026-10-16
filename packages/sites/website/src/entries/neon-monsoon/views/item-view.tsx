/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { textures, type ItemKind } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ItemViewBindings {
    kind: () => ItemKind;
    x: () => number;
    y: () => number;
    ageMs: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A power-up or bomb, pulsing gently so it stands out from the bullets. */
export function ItemView(bindings: ItemViewBindings): Container {
    const itemTextures = textures.get().item;
    return (
        <sprite
            texture={() => itemTextures[bindings.kind()]}
            anchor={0.5}
            x={bindings.x}
            y={bindings.y}
            scale={() => 1 + 0.12 * Math.sin(bindings.ageMs() * 0.012)}
        />
    );
}
