import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface UfoViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createUfoView(bindings: UfoViewBindings): Container {
    const watcher = watch({
        active: bindings.isActive,
        alive: bindings.isAlive,
    });

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        const sprite = new Sprite({ texture: textures.get().ufo, anchor: 0.5 });
        view.addChild(sprite);
        view.visible = false;
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.active.changed || watched.alive.changed) {
            view.visible = (watched.active.value as boolean) && (watched.alive.value as boolean);
        }
        if (!view.visible) return;

        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
