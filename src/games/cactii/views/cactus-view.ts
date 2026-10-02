import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#mvt-utils';
import type { CactusKind } from '../models';
import { textures } from '../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX, PANEL_COLOURS } from './view-constants';
import { onTick } from '../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CactusViewBindings {
    kind: () => CactusKind;
    x: () => number;
    y: () => number;
    alpha: () => number;
    scale: () => number;
    rotation: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CactusView(bindings: CactusViewBindings): Container {
    const view = new Container();
    const panel = buildPanel(bindings.kind());
    const sprite = new Sprite({ texture: textureForKind(bindings.kind()), anchor: 0.5 });
    sprite.scale.set(SPRITE_SCALE);
    const watcher = watch({
        kind: bindings.kind,
    });

    view.addChild(panel, sprite);
    onTick(view, { refresh });
    return view;

    function refresh(): void {
        view.position.set(bindings.x(), bindings.y());
        view.alpha = bindings.alpha();
        view.scale.set(bindings.scale());
        view.rotation = bindings.rotation();

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
