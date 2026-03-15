import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { EnemyKind, EnemyPhase } from '../models';
import { getTexture } from '../data';

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
    let sprite: Sprite;

    const kindTextures: Record<EnemyKind, Texture> = {
        boss: getTexture('boss'),
        butterfly: getTexture('butterfly'),
        bee: getTexture('bee'),
    };

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: kindTextures[bindings.getKind()], anchor: 0.5 });
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
            sprite.texture = kindTextures[bindings.getKind()];
        }
    }
}
