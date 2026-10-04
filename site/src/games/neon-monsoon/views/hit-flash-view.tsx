/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HitFlashViewBindings {
    /** The sprite to flash, drawn again over it: fixed, or changing with the thing it shows. */
    texture: ValueOrGetter<Texture>;
    /** Milliseconds since the thing was last hit. */
    msSinceHit: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A brief white flash over a sprite each time it takes damage: the sprite
 * drawn again on top, with additive blending, fading out.
 *
 * It keeps no state. The model records when each enemy was last hit, so the
 * flash is a function of that alone. That matters inside a `<List>`, where
 * the same view shows one enemy after another as its slot is reused: state
 * kept by the view would carry over from the last occupant.
 */
export function HitFlashView(bindings: HitFlashViewBindings): Container {
    return (
        <sprite
            texture={bindings.texture}
            anchor={0.5}
            ref={(sprite) => { sprite.blendMode = 'add'; }}
            visible={() => bindings.msSinceHit() < FLASH_MS}
            alpha={() => 1 - bindings.msSinceHit() / FLASH_MS}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLASH_MS = 90;
