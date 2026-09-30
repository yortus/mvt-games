/** @jsxImportSource #pixi-mvt/jsx */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FuelTankViewBindings {
    screenX: () => number;
    screenY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A fuel tank on the ground. */
export function FuelTankView(bindings: FuelTankViewBindings): Container {
    return (
        <sprite
            texture={textures.get().fuelTank}
            anchor={0.5}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
