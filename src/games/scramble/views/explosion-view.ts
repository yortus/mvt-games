import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplosionViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isActive(): boolean;
    getProgress(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExplosionView(bindings: ExplosionViewBindings): Container {
    const maxRadius = TILE_SIZE * 0.8;
    const watcher = watch({ active: bindings.isActive });

    const gfx = new Graphics();
    const view = new Container();
    view.addChild(gfx);
    view.visible = false;
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.active.changed) {
            view.visible = watched.active.value as boolean;
        }
        if (!view.visible) return;

        const progress = bindings.getProgress();
        const radius = maxRadius * progress;
        const alpha = 1 - progress;

        gfx.clear();
        // Outer burst - orange/yellow
        gfx.circle(0, 0, radius);
        gfx.fill({ color: 0xff8800, alpha: alpha * 0.6 });
        // Inner core - white/yellow
        gfx.circle(0, 0, radius * 0.5);
        gfx.fill({ color: 0xffff00, alpha });

        view.position.set(bindings.getScreenX(), bindings.getScreenY());
    }
}
