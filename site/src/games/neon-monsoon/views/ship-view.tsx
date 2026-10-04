/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { textures } from '../data';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    x: () => number;
    y: () => number;
    isAlive: () => boolean;
    /** Time left immune to bullets; the ship blinks while it lasts. */
    invulnerableMs: () => number;
    /** A clock that counts the game's steps, for the engine's flicker. */
    stepCount: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The interceptor and its engine flame, hidden while it is not alive. */
export function ShipView(bindings: ShipViewBindings): Container {
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            visible={bindings.isAlive}
            alpha={() => blinkAlpha(bindings.invulnerableMs())}
        >
            <graphics y={11} scale={() => flameScale(bindings.stepCount())} ref={drawFlame} />
            <sprite texture={textures.get().ship.sprite} anchor={0.5} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BLINK_MS = 100;

function blinkAlpha(invulnerableMs: number): number {
    if (invulnerableMs <= 0) return 1;
    return Math.floor(invulnerableMs / BLINK_MS) % 2 === 0 ? 1 : 0.35;
}

/** The flame stretches and shrinks a little every few steps. */
function flameScale(stepCount: number): number {
    return 0.8 + 0.2 * ((stepCount >> 1) % 3);
}

function drawFlame(g: Graphics): void {
    g.moveTo(-2, 0).lineTo(2, 0).lineTo(0, 6).closePath().fill(NEON.blue);
    g.moveTo(-1, 0).lineTo(1, 0).lineTo(0, 3).closePath().fill(0xd8fbff);
}
