import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { BULLET_SPEED } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DriftingBulletViewBindings {
    readonly x: () => number;
    readonly y: () => number;
    /** Where the gun is. Read once. */
    readonly gunY: number;
    /** How far up the bullet flies. Read once. */
    readonly topY: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Don't do this: the view runs its own animation. It reads the bullet's
 * position once, then moves the bullet up a little on every frame. To keep
 * going, it has to copy the model's rule for firing again, too. Slow the
 * model's time down, or pause it: the views are still refreshed every
 * frame, so this bullet flies on at full speed.
 */
export function DriftingBulletView(bindings: DriftingBulletViewBindings): Container {
    const view = new Container();
    view.position.set(bindings.x(), bindings.y());
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xff6655);
    view.addChild(gfx);

    function refresh(): void {
        view.y -= BULLET_SPEED_PER_FRAME;
        // A copy of the model's rule, which can drift from it too
        if (view.y < bindings.topY) view.y += bindings.gunY - bindings.topY;
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The model's speed, for one frame at 60 frames a second. A faster screen refreshes more often. */
const BULLET_SPEED_PER_FRAME = BULLET_SPEED * (1000 / 60);
