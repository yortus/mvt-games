import { Container, Sprite } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FuelTankViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isPresent(): boolean;
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
        const isPresent = view.visible = bindings.isPresent();
        if (!isPresent) return;
        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
