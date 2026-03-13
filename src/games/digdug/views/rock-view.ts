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
    const watched = createWatcher({
        phase: bindings.getPhase,
        tileSize: bindings.getTileSize,
    });

    const container = new Container();
    const sprite = new Sprite({ texture: textures.rock, anchor: 0.5 });
    container.addChild(sprite);

    let wobbleToggle = false;

    sprite.scale.set(watched.tileSize.value / 20);
    container.onRender = refresh;
    return container;

    function refresh(): void {
        container.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        sprite.scale.set(ts / 20);

        watched.poll();
        if (watched.phase.changed) {
            sprite.texture = watched.phase.value === 'shattered' ? textures.shattered : textures.rock;
        }

        // Wobble: alternate x offset each frame (presentation-only state)
        let wobbleOffset = 0;
        if (watched.phase.value === 'wobbling') {
            wobbleToggle = !wobbleToggle;
            wobbleOffset = wobbleToggle ? 2 : -2;
        }

        container.position.set(x + wobbleOffset, y);
    }
}
