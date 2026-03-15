import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { RockPhase } from '../models';
import { getTexture } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    getX(): number;
    getY(): number;
    getPhase(): RockPhase;
    isAlive(): boolean;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRockView(bindings: RockViewBindings): Container {
    const watcher = watch({
        phase: bindings.getPhase,
        tileSize: bindings.getTileSize,
    });

    let sprite: Sprite;
    let wobbleToggle = false;

    let normalTex: Texture;
    let shatteredTex: Texture;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        normalTex = getTexture('rock');
        shatteredTex = getTexture('rock-shattered');

        sprite = new Sprite({ texture: normalTex, anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        sprite.scale.set(ts / 20);

        const watched = watcher.poll();
        if (watched.phase.changed) {
            sprite.texture = watched.phase.value === 'shattered' ? shatteredTex : normalTex;
        }

        // Wobble: alternate x offset each frame (presentation-only state)
        let wobbleOffset = 0;
        if (watched.phase.value === 'wobbling') {
            wobbleToggle = !wobbleToggle;
            wobbleOffset = wobbleToggle ? 2 : -2;
        }

        view.position.set(x + wobbleOffset, y);
    }
}
