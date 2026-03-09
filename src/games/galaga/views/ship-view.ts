import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    getX(): number;
    getY(): number;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipView(bindings: ShipViewBindings): Container {
    const watchAlive = createWatch(bindings.isAlive);

    const container = new Container();
    const bodyGfx = new Graphics();
    container.addChild(bodyGfx);

    drawShip();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const x = bindings.getX();
        const y = bindings.getY();
        container.position.set(x, y);

        if (watchAlive.changed()) {
            container.visible = watchAlive.value;
        }
    }

    function drawShip(): void {
        bodyGfx.clear();

        // --- Fighter ship drawn facing UP, origin at centre ---

        // Main hull — narrow arrowhead
        bodyGfx
            .moveTo(0, -12)
            .lineTo(5, -2)
            .lineTo(5, 8)
            .lineTo(-5, 8)
            .lineTo(-5, -2)
            .closePath()
            .fill(0xffffff);

        // Nose highlight
        bodyGfx
            .moveTo(0, -12)
            .lineTo(3, -4)
            .lineTo(-3, -4)
            .closePath()
            .fill(0x88ccff);

        // Cockpit canopy
        bodyGfx.ellipse(0, -3, 2, 3).fill(0x00ccff);

        // Left wing
        bodyGfx
            .moveTo(-5, 2)
            .lineTo(-12, 8)
            .lineTo(-12, 10)
            .lineTo(-5, 8)
            .closePath()
            .fill(0xccccff);

        // Right wing
        bodyGfx
            .moveTo(5, 2)
            .lineTo(12, 8)
            .lineTo(12, 10)
            .lineTo(5, 8)
            .closePath()
            .fill(0xccccff);

        // Wing tips — blue accents
        bodyGfx.rect(-12, 8, 3, 2).fill(0x4488ff);
        bodyGfx.rect(9, 8, 3, 2).fill(0x4488ff);

        // Engine glow
        bodyGfx.rect(-3, 8, 2, 3).fill(0xff6600);
        bodyGfx.rect(1, 8, 2, 3).fill(0xff6600);
        bodyGfx.rect(-1, 9, 2, 3).fill(0xffcc00);
    }
}
