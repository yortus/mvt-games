import { Container, Sprite } from 'pixi.js';
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

        view.visible = bindings.isAlive();
    }
}
