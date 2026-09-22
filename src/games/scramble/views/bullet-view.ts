import { Container, Sprite } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().bullet, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const isActive = view.visible = bindings.isActive();
        if (!isActive) return;
        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
