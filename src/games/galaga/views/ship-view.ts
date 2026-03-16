import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    getX(): number;
    getY(): number;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipView(bindings: ShipViewBindings): Container {
    const watcher = watch({ alive: bindings.isAlive });

    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: textures.get().ship.sprite, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());

        const watched = watcher.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }
    }
}
