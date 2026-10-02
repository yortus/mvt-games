import { Container, Graphics } from 'pixi.js';
import { setTickMethods } from '../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    x: () => number;
    y: () => number;
    isActive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function BulletView(bindings: BulletViewBindings): Container {
    let gfx: Graphics;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        gfx = new Graphics();
        view.addChild(gfx);
        drawBullet();
    }

    function refresh(): void {
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        view.position.set(bindings.x(), bindings.y());
    }

    function drawBullet(): void {
        gfx.clear();
        gfx.circle(0, 0, 2).fill(0xffffff);
    }
}
