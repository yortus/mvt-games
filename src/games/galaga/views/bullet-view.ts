import { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    getX(): number;
    getY(): number;
    isActive(): boolean;
    /** Fill colour for this bullet. */
    getColor(): number;
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
        const color = bindings.getColor();
        gfx.rect(-1.5, -4, 3, 8).fill(color);
        gfx.circle(0, -4, 1.5).fill(color);
        gfx.circle(0, 4, 1.5).fill(color);
    }
}
