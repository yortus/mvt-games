import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';
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
    const watchPhase = createWatch(bindings.getPhase);
    const watchTileSize = createWatch(bindings.getTileSize);

    const container = new Container();
    const sprite = new Sprite({ texture: textures.rock, anchor: 0.5 });
    container.addChild(sprite);

    let wobbleToggle = false;

    sprite.scale.set(watchTileSize.value / 20);
    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (!bindings.isAlive()) {
            container.visible = false;
            return;
        }
        container.visible = true;

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;

        const phaseChanged = watchPhase.changed();
        if (watchTileSize.changed()) {
            sprite.scale.set(ts / 20);
        }

        const phase = bindings.getPhase();

        if (phaseChanged) {
            sprite.texture = phase === 'shattered' ? textures.shattered : textures.rock;
        }

        // Wobble: alternate x offset each frame (presentation-only state)
        let wobbleOffset = 0;
        if (phase === 'wobbling') {
            wobbleToggle = !wobbleToggle;
            wobbleOffset = wobbleToggle ? 2 : -2;
        }

        container.position.set(x + wobbleOffset, y);
    }
}
