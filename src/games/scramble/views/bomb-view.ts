import { Container, Sprite } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BombViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBombView(bindings: BombViewBindings): Container {
    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().bomb, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
