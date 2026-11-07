import { Container, Sprite, type Texture } from 'pixi.js';
import { createReaction } from '@mvtjs/utils';
import { textures } from '../data';
import type { RockPhase } from '../models';
import { setRefresh, setUpdate } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    col: () => number;
    row: () => number;
    phase: () => RockPhase;
    isAlive: () => boolean;
    tileSize: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function RockView(bindings: RockViewBindings): Container {
    const rockTextures = textures.get().rock;
    let sprite: Sprite;
    // Presentation state: how long the rock has been wobbling
    let wobbleMs = 0;

    const updateTextureWhenPhaseChanges = createReaction({
        watch: bindings.phase,
        react: (phase) => {
            sprite.texture = textureFor(phase);
        },
    });

    const view = new Container();
    initialiseView();
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: textureFor(bindings.phase()), anchor: 0.5 });
        view.addChild(sprite);
    }

    function update(deltaMs: number): void {
        wobbleMs = bindings.phase() === 'wobbling' ? wobbleMs + deltaMs : 0;
    }

    function refresh(): void {
        // Called while hidden too, so a change then is drawn, and not missed
        updateTextureWhenPhaseChanges();

        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.tileSize();
        const x = bindings.col() * ts + ts / 2;
        const y = bindings.row() * ts + ts / 2;
        view.position.set(x, y);
        sprite.scale.set(ts / 20);

        if (bindings.phase() === 'wobbling') view.position.x = x + Math.sin(wobbleMs * WOBBLE_RATE) * WOBBLE_PIXELS;
    }

    function textureFor(phase: RockPhase): Texture {
        return phase === 'shattered' ? rockTextures.shattered : rockTextures.normal;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How fast a rock wobbles, in radians a millisecond, and how far either way. */
const WOBBLE_RATE = 0.05;
const WOBBLE_PIXELS = 2;
