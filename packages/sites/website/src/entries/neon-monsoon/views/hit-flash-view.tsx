/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi';
import { NEON } from './view-constants';

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
 * A brief flash over a sprite each time it takes damage: the sprite drawn
 * again on top, tinted violet, fading out. A tint rather than a brightening,
 * since the enemy hulls are already near white.
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
            tint={NEON.violet}
            visible={() => bindings.msSinceHit() < FLASH_MS}
            alpha={() => MAX_ALPHA * (1 - bindings.msSinceHit() / FLASH_MS)}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLASH_MS = 90;
const MAX_ALPHA = 0.85;
