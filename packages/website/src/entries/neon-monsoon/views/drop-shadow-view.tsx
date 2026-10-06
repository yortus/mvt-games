/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DropShadowViewBindings {
    /** The craft's sprite, whose silhouette the shadow takes: fixed, or changing with the craft it shows. */
    texture: ValueOrGetter<Texture>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The shadow a flying craft casts on the city far below: its silhouette in
 * translucent black, offset down and to the right, away from the light. It
 * lifts the craft off the ground, so it never reads as part of the city.
 * Place it before the craft's sprite, so the craft is drawn over it.
 */
export function DropShadowView(bindings: DropShadowViewBindings): Container {
    return (
        <sprite
            texture={bindings.texture}
            anchor={0.5}
            x={SHADOW_OFFSET_X}
            y={SHADOW_OFFSET_Y}
            tint={0x000000}
            alpha={SHADOW_ALPHA}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHADOW_OFFSET_X = 5;
const SHADOW_OFFSET_Y = 9;
const SHADOW_ALPHA = 0.4;
