import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import type { EnemyKind, EnemyPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    x: () => number;
    y: () => number;
    kind: () => EnemyKind;
    phase: () => EnemyPhase;
    isAlive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function EnemyView(bindings: EnemyViewBindings): Container {
    const watcher = watch({
        kind: bindings.kind,
        phase: bindings.phase,
    });

    const enemyTextures = textures.get().enemy;
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        // No texture yet: the view may be built before it has an enemy (in a
        // list slot, say). The first refresh sets it, since the watcher reports
        // every value as changed on its first poll.
        sprite = new Sprite({ anchor: 0.5 });
        view.addChild(sprite);
    }

    function refresh(): void {
        const phase = bindings.phase();
        const visible = phase !== 'dead' && phase !== 'entering';
        view.visible = visible;
        if (!visible) return;

        const watched = watcher.poll();
        view.position.set(bindings.x(), bindings.y());
        if (watched.phase.changed || watched.kind.changed) {
            sprite.texture = enemyTextures[bindings.kind()];
        }
    }
}
