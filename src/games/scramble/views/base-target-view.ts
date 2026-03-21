import { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BaseTargetViewBindings {
    getScreenX(): number;
    getScreenY(): number;
    isBaseAlive(): boolean;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBaseTargetView(bindings: BaseTargetViewBindings): Container {
    let flashTimer = 0;

    const tileSize = bindings.getTileSize();
    const width = tileSize * 2;
    const height = tileSize * 1.5;

    // Main body - large red structure
    const body = new Graphics();
    body.rect(-width / 2, -height / 2, width, height);
    body.fill(0xcc2222);
    body.stroke({ color: 0xff4444, width: 2 });

    // Inner detail - dark centre
    const inner = new Graphics();
    const innerW = width * 0.5;
    const innerH = height * 0.4;
    inner.rect(-innerW / 2, -innerH / 2, innerW, innerH);
    inner.fill(0x881111);

    const view = new Container();
    view.addChild(body, inner);
    view.visible = false;
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const alive = bindings.isBaseAlive();
        view.visible = alive;
        if (!alive) {
            flashTimer = 0;
            return;
        }

        view.position.set(bindings.getScreenX(), bindings.getScreenY());

        // Pulse effect to draw attention
        flashTimer += 16;
        const pulse = 0.85 + 0.15 * Math.sin(flashTimer * 0.006);
        view.scale.set(pulse);
    }
}
