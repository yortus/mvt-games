import { Container, Sprite } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { textures } from '../data';
import type { Direction } from '../models';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MouseViewBindings {
    row: () => number;
    col: () => number;
    direction: () => Direction;
    tileSize: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function MouseView(bindings: MouseViewBindings): Container {
    const watcher = watch({ direction: bindings.direction });

    const mouseTextures = textures.get().mouse;
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: mouseTextures.tailMid, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.tileSize();
        const col = bindings.col();
        const row = bindings.row();
        view.position.set(col * ts + ts / 2, row * ts + ts / 2);
        sprite.scale.set(ts / 20);

        // The tail swishes once per tile travelled, so it follows the mouse's
        // position and stays still when the mouse does
        const swish = Math.sin((col + row) * Math.PI * 2);
        sprite.texture = swish < -0.33
            ? mouseTextures.tailUp
            : swish > 0.33 ? mouseTextures.tailDown : mouseTextures.tailMid;

        if (watched.direction.changed) {
            view.rotation = directionToRotation(watched.direction.value);
        }
    }

    function directionToRotation(dir: Direction): number {
        switch (dir) {
            case 'right': return 0;
            case 'down':  return Math.PI / 2;
            case 'left':  return Math.PI;
            case 'up':    return -Math.PI / 2;
        }
    }
}
