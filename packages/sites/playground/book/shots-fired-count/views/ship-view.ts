import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Bullet } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    /** Where the ship is. Read once, since this ship never moves. */
    readonly x: number;
    readonly y: number;
    readonly bullets: () => readonly Bullet[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The ship, and its bullets in flight. */
export function ShipView(bindings: ShipViewBindings): Container {
    const view = new Container();

    const ship = new Graphics().poly([0, -16, -14, 12, 0, 6, 14, 12]).fill(0x44ffaa);
    ship.position.set(bindings.x, bindings.y);

    // One Graphics for each bullet, added and removed as the bullets come and go
    const bulletLayer = new Container();
    view.addChild(bulletLayer, ship);

    function refresh(): void {
        const bullets = bindings.bullets();
        while (bulletLayer.children.length > bullets.length) {
            bulletLayer.removeChildAt(bulletLayer.children.length - 1).destroy();
        }
        while (bulletLayer.children.length < bullets.length) {
            bulletLayer.addChild(new Graphics().rect(-2, -6, 4, 12).fill(0xffd166));
        }
        for (let i = 0; i < bullets.length; i++) {
            bulletLayer.children[i].position.set(bullets[i].x, bullets[i].y);
        }
    }

    setRefresh(view, refresh);
    return view;
}
