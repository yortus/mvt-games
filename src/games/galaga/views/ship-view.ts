import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';

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

export function createShipView(bindings: ShipViewBindings, texture: Texture): Container {
    const watcher = watch({ alive: bindings.isAlive });

    const view = new Container();
    const sprite = new Sprite({ texture, anchor: 0.5 });
    view.addChild(sprite);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());

        const watched = watcher.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }
    }
}
