import { Container, Sprite } from 'pixi.js';
import { watch } from '#mvt-utils';
import { textures } from '../data';
import type { EnemyKind, EnemyPhase } from '../models';
import { setTickMethods } from '../../../pixi-mvt';

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
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: enemyTextures[bindings.kind()], anchor: 0.5 });
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
