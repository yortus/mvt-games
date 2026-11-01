/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { shieldTexture, shipTexture } from './textures';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the shield takes to turn once round the ship, in ms. */
const SHIELD_TURN_MS = 3000;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    readonly x: () => number;
    readonly y: () => number;
    readonly isShielded: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship, and its shield, which shows while the ship is shielded. A plain
 * value, such as `alpha={0.6}`, is set once. A function, such as
 * `visible={bindings.isShielded}`, is a getter, read again every frame.
 *
 * The shield also turns round the ship. The model knows nothing of that:
 * the shield's angle is presentation state, kept here, moved on by
 * `onUpdate` and written by the `rotation` getter.
 *
 * Try bringing back the bug from the start of the chapter: write
 * `visible={bindings.isShielded()}`, which calls the getter once, as the
 * view is built. The shield then stays up for good.
 */
export function ShipView(bindings: ShipViewBindings): Container {
    // Presentation state: how far the shield has turned, in radians
    let shieldAngle = 0;

    return (
        <container x={bindings.x} y={bindings.y} onUpdate={turnShield}>
            <sprite texture={shipTexture} anchor={0.5} />
            <sprite
                texture={shieldTexture}
                anchor={0.5}
                alpha={0.6}
                visible={bindings.isShielded}
                rotation={() => shieldAngle}
            />
        </container>
    );

    function turnShield(deltaMs: number): void {
        shieldAngle = (shieldAngle + (deltaMs / SHIELD_TURN_MS) * TURN) % TURN;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One whole turn, in radians. */
const TURN = Math.PI * 2;
