import { Container, Sprite, Ticker } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { textures } from '../data';
import type { RockPhase } from '../models';
import { setTickMethods } from '@mvtjs/pixi';

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
    const watcher = watch({
        phase: bindings.phase,
        tileSize: bindings.tileSize,
    });

    const clock = bindings.clock ?? (() => Ticker.shared.lastTime);
    const rockTextures = textures.get().rock;
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: rockTextures.normal, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.tileSize();
        const x = bindings.col() * ts + ts / 2;
        const y = bindings.row() * ts + ts / 2;
        view.position.set(x, y);
        sprite.scale.set(ts / 20);

        const watched = watcher.poll();
        if (watched.phase.changed) {
            sprite.texture = watched.phase.value === 'shattered' ? rockTextures.shattered : rockTextures.normal;
        }

        // Wobble (presentation-only state)
        if (watched.phase.value === 'wobbling') {
            const time = clock();
            const wobbleOffset = Math.sin(time * 0.05) * 2;
            view.position.x = x + wobbleOffset;
        }
    }
}
