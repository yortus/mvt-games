import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { CactusKind } from '../models';
import { textures } from '../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX, PANEL_COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CactusViewBindings {
    getKind(): CactusKind;
    getX(): number;
    getY(): number;
    getAlpha(): number;
    getScale(): number;
    getRotation(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCactusView(bindings: CactusViewBindings): Container {
    const view = new Container();
    const panel = buildPanel(bindings.getKind());
    const sprite = new Sprite({ texture: textureForKind(bindings.getKind()), anchor: 0.5 });
    sprite.scale.set(SPRITE_SCALE);
    const watcher = watch({
        kind: bindings.getKind,
    });

    view.addChild(panel, sprite);
    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());
        view.alpha = bindings.getAlpha();
        view.scale.set(bindings.getScale());
        view.rotation = bindings.getRotation();

        const watched = watcher.poll();
        if (watched.kind.changed) {
            sprite.texture = textureForKind(watched.kind.value);
            panel.clear()
                .rect(-CELL_WIDTH_PX / 2, -CELL_HEIGHT_PX / 2, CELL_WIDTH_PX, CELL_HEIGHT_PX)
                .fill(PANEL_COLOURS[watched.kind.value]);
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

function buildPanel(kind: CactusKind): Graphics {
    return new Graphics()
        .rect(-CELL_WIDTH_PX / 2, -CELL_HEIGHT_PX / 2, CELL_WIDTH_PX, CELL_HEIGHT_PX)
        .fill(PANEL_COLOURS[kind]);
}
