import { Container, Sprite } from 'pixi.js';
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
    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().ship.sprite, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const isAlive = view.visible = bindings.isAlive();
        if (!isAlive) return;
        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
