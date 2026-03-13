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
    const watcher = createWatcher({
        color: bindings.getColor,
        tileSize: bindings.getTileSize,
    });

    const view = new Container();
    const bodySprite = new Sprite({ texture: textures.body, anchor: 0.5 });
    const eyesSprite = new Sprite({ texture: textures.eyes, anchor: 0.5 });
    bodySprite.tint = bindings.getColor();
    view.addChild(bodySprite);
    view.addChild(eyesSprite);

    const s = bindings.getTileSize() / 20;
    bodySprite.scale.set(s);
    eyesSprite.scale.set(s);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.getTileSize();
        view.position.set(
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
