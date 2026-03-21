import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import type { RocketPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RocketViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
    isAlive(): boolean;
    getPhase(): RocketPhase;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRocketView(bindings: RocketViewBindings): Container {
    const watcher = watch({
        active: bindings.isActive,
        alive: bindings.isAlive,
        phase: bindings.getPhase,
    });

    let idleSprite: Sprite;
    let launchSprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        idleSprite = new Sprite({ texture: textures.get().rocket.idle, anchor: 0.5 });
        launchSprite = new Sprite({ texture: textures.get().rocket.launching, anchor: 0.5 });
        launchSprite.visible = false;
        view.addChild(idleSprite);
        view.addChild(launchSprite);
        view.visible = false;
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.active.changed || watched.alive.changed) {
            view.visible = (watched.active.value as boolean) && (watched.alive.value as boolean);
        }
        if (!view.visible) return;

        if (watched.phase.changed) {
            const phase = watched.phase.value as RocketPhase;
            idleSprite.visible = phase === 'idle';
            launchSprite.visible = phase === 'launching' || phase === 'flying';
        }

        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
