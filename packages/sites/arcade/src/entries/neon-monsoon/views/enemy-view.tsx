/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import { DropShadowView } from './drop-shadow-view';
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
    /** Whether it flies, and so casts a shadow on the city; a rooftop turret does not. Read once. */
    hasShadow: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Any enemy but the boss: its shadow if it flies, its sprite, and a flash when hit. */
export function EnemyView(bindings: EnemyViewBindings): Container {
    return (
        <container x={bindings.x} y={bindings.y}>
            {bindings.hasShadow ? <DropShadowView texture={bindings.texture} /> : undefined}
            <sprite texture={bindings.texture} anchor={0.5} />
            <HitFlashView texture={bindings.texture} msSinceHit={bindings.msSinceHit} />
        </container>
    );
}
