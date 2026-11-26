import { Container, Graphics } from 'pixi.js';
import { createReaction } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    x: () => number;
    y: () => number;
    isActive: () => boolean;
    /** Fill colour for this bullet. */
    color: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function BulletView(bindings: BulletViewBindings): Container {
    const drawBulletWhenColorChanges = createReaction({ watch: bindings.color, react: drawBullet });
    let gfx: Graphics;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        gfx = new Graphics();
        view.addChild(gfx);
        drawBullet();
    }

    function refresh(): void {
        // Before the early return, so a colour changed while the bullet is hidden isn't missed
        drawBulletWhenColorChanges();
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        view.position.set(bindings.x(), bindings.y());
    }

    function drawBullet(): void {
        gfx.clear();
        const color = bindings.color();
        gfx.rect(-1.5, -4, 3, 8).fill(color);
        gfx.circle(0, -4, 1.5).fill(color);
        gfx.circle(0, 4, 1.5).fill(color);
    }
}
