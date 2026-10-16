import { Container, Sprite } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { textures } from '../data';
import type { Direction } from '../models';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CatViewBindings {
    row: () => number;
    col: () => number;
    direction: () => Direction;
    /** Coat colour, tinting the body but not the face. */
    color: () => number;
    tileSize: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CatView(bindings: CatViewBindings): Container {
    const watcher = watch({
        color: bindings.color,
        direction: bindings.direction,
        tileSize: bindings.tileSize,
    });

    let bodySprite: Sprite;
    let faceSprite: Sprite;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        const cat = textures.get().cat;
        bodySprite = new Sprite({ texture: cat.body, anchor: 0.5 });
        faceSprite = new Sprite({ texture: cat.face, anchor: 0.5 });
        view.addChild(bodySprite);
        view.addChild(faceSprite);
    }

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.tileSize();
        view.position.set(bindings.col() * ts + ts / 2, bindings.row() * ts + ts / 2);

        if (watched.color.changed) {
            bodySprite.tint = watched.color.value;
        }

        if (watched.direction.changed) {
            view.rotation = directionToRotation(watched.direction.value);
        }

        if (watched.tileSize.changed) {
            view.scale.set(ts / 20);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The textures face right; turn them to face the way the cat is going. */
function directionToRotation(dir: Direction): number {
    switch (dir) {
        case 'right': return 0;
        case 'down':  return Math.PI / 2;
        case 'left':  return Math.PI;
        case 'up':    return -Math.PI / 2;
    }
}
