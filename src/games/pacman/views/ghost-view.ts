import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';

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

export function createGhostView(bindings: GhostViewBindings): Container {
    const watcher = watch({
        color: bindings.getColor,
        tileSize: bindings.getTileSize,
    });

    let bodySprite: Sprite;
    let eyesSprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        bodySprite = new Sprite({ texture: textures.get().ghostBody, anchor: 0.5 });
        eyesSprite = new Sprite({ texture: textures.get().ghostEyes, anchor: 0.5 });
        view.addChild(bodySprite);
        view.addChild(eyesSprite);
    }

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
