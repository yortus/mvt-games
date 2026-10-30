import { Container, Sprite, Ticker, type Texture } from 'pixi.js';
import { createReaction } from '@mvtjs/utils';
import { textures } from '../data';
import type { RockPhase } from '../models';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    col: () => number;
    row: () => number;
    phase: () => RockPhase;
    isAlive: () => boolean;
    tileSize: () => number;
    clock?: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function RockView(bindings: RockViewBindings): Container {
    const clock = bindings.clock ?? (() => Ticker.shared.lastTime);
    const rockTextures = textures.get().rock;
    let sprite: Sprite;

    const updateTextureWhenPhaseChanges = createReaction({
        watch: bindings.phase,
        react: (phase) => {
            sprite.texture = textureFor(phase);
        },
    });

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: textureFor(bindings.phase()), anchor: 0.5 });
        view.addChild(sprite);
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

        // Wobble (presentation-only state)
        if (bindings.phase() === 'wobbling') {
            const time = clock();
            const wobbleOffset = Math.sin(time * 0.05) * 2;
            view.position.x = x + wobbleOffset;
        }
    }

    function textureFor(phase: RockPhase): Texture {
        return phase === 'shattered' ? rockTextures.shattered : rockTextures.normal;
    }
}
