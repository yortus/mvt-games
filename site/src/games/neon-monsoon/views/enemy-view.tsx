/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import { HitFlashView } from './hit-flash-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    /** Changes when a different kind of enemy takes this view's slot. */
    texture: () => Texture;
    x: () => number;
    y: () => number;
    msSinceHit: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Any enemy but the boss: its sprite, flashing when hit. */
export function EnemyView(bindings: EnemyViewBindings): Container {
    return (
        <container x={bindings.x} y={bindings.y}>
            <sprite texture={bindings.texture} anchor={0.5} />
            <HitFlashView texture={bindings.texture} msSinceHit={bindings.msSinceHit} />
        </container>
    );
}
