import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplosionViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isPresent(): boolean;
    getProgress(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExplosionView(bindings: ExplosionViewBindings): Container {
    const maxRadius = TILE_SIZE * 0.8;

    const gfx = new Graphics();
    const view = new Container();
    view.addChild(gfx);
    view.onRefresh = refresh;
    return view;

    function refresh(): void {
        const isPresent = view.visible = bindings.isPresent();
        if (!isPresent) return;

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
