import { Container, Sprite } from 'pixi.js';
import { textures } from '../data';
import type { RocketPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RocketViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isPresent(): boolean;
    getPhase(): RocketPhase;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRocketView(bindings: RocketViewBindings): Container {
    let idleSprite: Sprite;
    let launchSprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        idleSprite = new Sprite({ texture: textures.get().rocket.idle, anchor: 0.5 });
        launchSprite = new Sprite({ texture: textures.get().rocket.launching, anchor: 0.5 });
        launchSprite.visible = false;
        view.addChild(idleSprite);
        view.addChild(launchSprite);
    }

    function refresh(): void {
        const isPresent = view.visible = bindings.isPresent();
        if (!isPresent) return;
        const phase = bindings.getPhase();
        idleSprite.visible = phase === 'idle';
        launchSprite.visible = phase === 'launching' || phase === 'flying';
        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
