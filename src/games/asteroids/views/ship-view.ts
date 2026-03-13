import { Container, Graphics } from 'pixi.js';
import { createWatcher } from '#utils';

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
    const watched = createWatcher({ alive: bindings.isAlive });

    const view = new Container();
    const bodyGfx = new Graphics();
    const flameGfx = new Graphics();
    view.addChild(bodyGfx);
    view.addChild(flameGfx);

    drawShip();
    drawFlame();
    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());
        view.rotation = bindings.getAngle();

        watched.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value;
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
