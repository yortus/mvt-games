import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipView(bindings: ShipViewBindings): Container {
    const watcher = watch({ alive: bindings.isAlive });

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().ship.sprite, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value as boolean;
        }
        if (!view.visible) return;

        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
