import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatcher } from '#utils';
import type { RockPhase } from '../models';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface RockViewTextures {
    readonly rock: Texture;
    readonly shattered: Texture;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    getX(): number;
    getY(): number;
    getPhase(): RockPhase;
    isAlive(): boolean;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRockView(
    bindings: RockViewBindings,
    textures: RockViewTextures,
): Container {
    const watcher = createWatcher({
        phase: bindings.getPhase,
        tileSize: bindings.getTileSize,
    });

    const view = new Container();
    const sprite = new Sprite({ texture: textures.rock, anchor: 0.5 });
    view.addChild(sprite);

    let wobbleToggle = false;

    sprite.scale.set(bindings.getTileSize() / 20);
    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        sprite.scale.set(ts / 20);

        const watched = watcher.poll();
        if (watched.phase.changed) {
            sprite.texture = watched.phase.value === 'shattered' ? textures.shattered : textures.rock;
        }

        // Wobble: alternate x offset each frame (presentation-only state)
        let wobbleOffset = 0;
        if (watched.phase.value === 'wobbling') {
            wobbleToggle = !wobbleToggle;
            wobbleOffset = wobbleToggle ? 2 : -2;
        }

        view.position.set(x + wobbleOffset, y);
    }
}
