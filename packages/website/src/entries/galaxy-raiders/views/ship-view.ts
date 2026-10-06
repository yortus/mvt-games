import { Container, Sprite } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { textures } from '../data';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    x: () => number;
    y: () => number;
    isAlive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function ShipView(bindings: ShipViewBindings): Container {
    const watcher = watch({ alive: bindings.isAlive });

    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: textures.get().ship.sprite, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        view.position.set(bindings.x(), bindings.y());

        const watched = watcher.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }
    }
}
