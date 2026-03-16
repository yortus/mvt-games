import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import type { EnemyKind, EnemyPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    getX(): number;
    getY(): number;
    getKind(): EnemyKind;
    getPhase(): EnemyPhase;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyView(bindings: EnemyViewBindings): Container {
    const watcher = watch({
        kind: bindings.getKind,
        phase: bindings.getPhase,
    });

    const tx = textures.get();
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: tx[bindings.getKind()], anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const phase = bindings.getPhase();
        const visible = phase !== 'dead' && phase !== 'entering';
        view.visible = visible;
        if (!visible) return;

        const watched = watcher.poll();
        view.position.set(bindings.getX(), bindings.getY());
        if (watched.phase.changed || watched.kind.changed) {
            sprite.texture = tx[bindings.getKind()];
        }
    }
}
