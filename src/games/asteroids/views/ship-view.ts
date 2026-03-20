import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';

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
    const watcher = watch({ alive: bindings.isAlive });
    let bodyGfx: Graphics;
    let flameGfx: Graphics;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        bodyGfx = new Graphics();
        flameGfx = new Graphics();
        view.addChild(bodyGfx);
        view.addChild(flameGfx);
        drawShip();
        drawFlame();
    }

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());
        view.rotation = bindings.getAngle();

        const watched = watcher.poll();
        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }

        flameGfx.visible = bindings.isThrusting();
    }

    function drawShip(): void {
        bodyGfx.clear();

        // Classic vector-style triangular ship, origin at centre, facing UP
        bodyGfx.moveTo(0, -12).lineTo(10, 10).lineTo(6, 7).lineTo(-6, 7).lineTo(-10, 10).closePath().fill(0xffffff);
    }

    function drawFlame(): void {
        flameGfx.clear();

        // Engine flame triangle behind ship
        flameGfx.moveTo(-5, 8).lineTo(0, 18).lineTo(5, 8).closePath().fill(0xff6600);

        flameGfx.moveTo(-3, 8).lineTo(0, 14).lineTo(3, 8).closePath().fill(0xffcc00);
    }
}
