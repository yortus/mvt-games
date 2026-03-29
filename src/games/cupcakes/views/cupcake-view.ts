import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { CupcakeKind } from '../models';
import { textures } from '../data';
import { CELL_SIZE_PX } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CupcakeViewBindings {
    getKind(): CupcakeKind;
    getX(): number;
    getY(): number;
    getAlpha(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCupcakeView(bindings: CupcakeViewBindings): Container {
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

const TEXTURE_SIZE = 16;
const SPRITE_SCALE = (CELL_SIZE_PX * 0.75) / TEXTURE_SIZE;

function textureForKind(kind: CupcakeKind): Texture {
    return textures.get().cupcake[kind];
}
