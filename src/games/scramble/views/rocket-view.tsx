/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import { textures } from '../data';
import type { RocketPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RocketViewBindings {
    screenX: () => number;
    screenY: () => number;
    phase: () => RocketPhase;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A rocket: standing on the ground while idle, with its flame once it launches. */
export function RocketView(bindings: RocketViewBindings): Container {
    const { idle, launching } = textures.get().rocket;
    return (
        <container x={bindings.screenX} y={bindings.screenY}>
            <sprite texture={idle} anchor={0.5} visible={() => bindings.phase() === 'idle'} />
            <sprite texture={launching} anchor={0.5} visible={() => bindings.phase() !== 'idle'} />
        </container>
    );
}
