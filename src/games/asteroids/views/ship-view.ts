import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    getX(): number;
    getY(): number;
    getAngle(): number;
    isAlive(): boolean;
    isThrusting(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipView(bindings: ShipViewBindings): Container {
    const watchAlive = createWatch(bindings.isAlive);

    const container = new Container();
    const bodyGfx = new Graphics();
    const flameGfx = new Graphics();
    container.addChild(bodyGfx);
    container.addChild(flameGfx);

    drawShip();
    drawFlame();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        container.position.set(bindings.getX(), bindings.getY());
        container.rotation = bindings.getAngle();

        if (watchAlive.changed()) {
            container.visible = watchAlive.value;
        }

        flameGfx.visible = bindings.isThrusting();
    }

    function drawShip(): void {
        bodyGfx.clear();

        // Classic vector-style triangular ship, origin at centre, facing UP
        bodyGfx
            .moveTo(0, -12)
            .lineTo(10, 10)
            .lineTo(6, 7)
            .lineTo(-6, 7)
            .lineTo(-10, 10)
            .closePath()
            .fill(0xffffff);
    }

    function drawFlame(): void {
        flameGfx.clear();

        // Engine flame triangle behind ship
        flameGfx
            .moveTo(-5, 8)
            .lineTo(0, 18)
            .lineTo(5, 8)
            .closePath()
            .fill(0xff6600);

        flameGfx
            .moveTo(-3, 8)
            .lineTo(0, 14)
            .lineTo(3, 8)
            .closePath()
            .fill(0xffcc00);
    }
}
