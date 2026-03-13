import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatcher } from '#utils';

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
    getRow(): number;
    getCol(): number;
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
    const watched = createWatcher({
        color: bindings.getColor,
        tileSize: bindings.getTileSize,
    });

    const container = new Container();
    const bodySprite = new Sprite({ texture: textures.body, anchor: 0.5 });
    const eyesSprite = new Sprite({ texture: textures.eyes, anchor: 0.5 });
    bodySprite.tint = bindings.getColor();
    container.addChild(bodySprite);
    container.addChild(eyesSprite);

    const s = watched.tileSize.value / 20;
    bodySprite.scale.set(s);
    eyesSprite.scale.set(s);

    container.onRender = refresh;
    return container;

    function refresh(): void {
        watched.poll();

        const ts = bindings.getTileSize();
        container.position.set(
            bindings.getCol() * ts + ts / 2,
            bindings.getRow() * ts + ts / 2,
        );

        if (watched.color.changed) {
            bodySprite.tint = watched.color.value;
        }

        if (watched.tileSize.changed) {
            const sc = ts / 20;
            bodySprite.scale.set(sc);
            eyesSprite.scale.set(sc);
        }
    }
}
