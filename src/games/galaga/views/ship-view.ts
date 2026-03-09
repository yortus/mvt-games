import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';

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
    const watchAlive = createWatch(bindings.isAlive);

    const container = new Container();
    const sprite = new Sprite({ texture, anchor: 0.5 });
    container.addChild(sprite);

    container.onRender = refresh;
    return container;

    function refresh(): void {
        container.position.set(bindings.getX(), bindings.getY());

        if (watchAlive.changed()) {
            container.visible = watchAlive.value;
        }
    }
}
