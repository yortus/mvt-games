import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#utils';
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
// Textures
// ---------------------------------------------------------------------------

export interface EnemyViewTextures {
    readonly boss: Texture;
    readonly butterfly: Texture;
    readonly bee: Texture;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyView(
    bindings: EnemyViewBindings,
    textures: EnemyViewTextures,
): Container {
    const watcher = watch({
        kind: bindings.getKind,
        phase: bindings.getPhase,
    });

    const view = new Container();
    const sprite = new Sprite({ texture: textures[bindings.getKind()], anchor: 0.5 });
    view.addChild(sprite);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const phase = bindings.getPhase();
        const visible = phase !== 'dead' && phase !== 'entering';
        view.visible = visible;
        if (!visible) return;

        const watched = watcher.poll();
        view.position.set(bindings.getX(), bindings.getY());
        if (watched.phase.changed || watched.kind.changed) {
            sprite.texture = textures[bindings.getKind()];
        }
    }
}
