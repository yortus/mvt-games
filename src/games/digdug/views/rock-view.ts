import { Container, Sprite, Ticker } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import type { RockPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    getCol(): number;
    getRow(): number;
    getPhase(): RockPhase;
    isAlive(): boolean;
    getTileSize(): number;
    getClock?: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRockView(bindings: RockViewBindings): Container {
    const watcher = watch({
        phase: bindings.getPhase,
        tileSize: bindings.getTileSize,
    });

    const clock = bindings.getClock ?? (() => Ticker.shared.lastTime);
    const rockTextures = textures.get().rock;
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: rockTextures.normal, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.getTileSize();
        const x = bindings.getCol() * ts + ts / 2;
        const y = bindings.getRow() * ts + ts / 2;
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
