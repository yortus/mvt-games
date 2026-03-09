import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface GhostViewTextures {
    readonly body: Texture;
    readonly eyes: Texture;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GhostViewBindings {
    getX(): number;
    getY(): number;
    getColor(): number;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGhostView(
    bindings: GhostViewBindings,
    textures: GhostViewTextures,
): Container {
    const watchColor = createWatch(bindings.getColor);
    const watchTileSize = createWatch(bindings.getTileSize);

    const container = new Container();
    const bodySprite = new Sprite({ texture: textures.body, anchor: 0.5 });
    const eyesSprite = new Sprite({ texture: textures.eyes, anchor: 0.5 });
    bodySprite.tint = bindings.getColor();
    container.addChild(bodySprite);
    container.addChild(eyesSprite);

    const s = watchTileSize.value / 20;
    bodySprite.scale.set(s);
    eyesSprite.scale.set(s);

    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        container.position.set(x, y);

        if (watchColor.changed()) {
            bodySprite.tint = watchColor.value;
        }

        if (watchTileSize.changed()) {
            const sc = ts / 20;
            bodySprite.scale.set(sc);
            eyesSprite.scale.set(sc);
        }
    }
}
