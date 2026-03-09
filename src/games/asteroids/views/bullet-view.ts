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
    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);

    drawBullet();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const active = bindings.isActive();
        container.visible = active;
        if (!active) return;

        container.position.set(bindings.getX(), bindings.getY());
    }

    function drawBullet(): void {
        gfx.clear();
        gfx.circle(0, 0, 2).fill(0xffffff);
    }
}
