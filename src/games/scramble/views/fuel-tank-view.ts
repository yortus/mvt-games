import { Container, Sprite } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FuelTankViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFuelTankView(bindings: FuelTankViewBindings): Container {
    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().fuelTank, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const isShown = view.visible = bindings.isActive() && bindings.isAlive();
        if (!isShown) return;
        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
