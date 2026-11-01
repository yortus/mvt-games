import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    readonly x: () => number;
    readonly y: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A bullet, drawn where the model says it is. Its refresh step reads the
 * position again every frame, so it keeps nothing that could drift.
 */
export function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.position.set(bindings.x(), bindings.y());
    }

    setRefresh(view, refresh);
    return view;
}
