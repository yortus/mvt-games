import { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    getX(): number;
    getY(): number;
    isActive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    view.addChild(gfx);

    drawBullet();
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        view.position.set(bindings.getX(), bindings.getY());
    }

    function drawBullet(): void {
        gfx.clear();
        gfx.circle(0, 0, 2).fill(0xffffff);
    }
}
