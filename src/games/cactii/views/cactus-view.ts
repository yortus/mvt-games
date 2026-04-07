import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { CactusKind } from '../models';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CactusViewBindings {
    getKind(): CactusKind;
    getX(): number;
    getY(): number;
    getAlpha(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCactusView(bindings: CactusViewBindings): Container {
    const view = new Container();
    const sprite = new Sprite({ texture: textureForKind(bindings.getKind()), anchor: 0.5 });
    sprite.scale.set(SPRITE_SCALE);
    const watcher = watch({
        kind: bindings.getKind,
    });

    view.addChild(sprite);
    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());
        view.alpha = bindings.getAlpha();

        const watched = watcher.poll();
        if (watched.kind.changed) {
            sprite.texture = textureForKind(watched.kind.value);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Scale factor: render each cactus at 75% of cell size for visual padding. */
const SPRITE_SCALE = 0.75;

function textureForKind(kind: CactusKind): Texture {
    return textures.get().cactus[kind];
}
