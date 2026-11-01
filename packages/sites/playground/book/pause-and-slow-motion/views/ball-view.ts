import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { BallModel } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a flash lasts, in ms of the time this view is given. */
const FLASH_MS = 150;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BallViewBindings {
    readonly model: BallModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ball, which flashes white each time it bounces on the floor. The
 * flash is presentation state, timed in this view's update step, so it
 * slows, speeds up and freezes with the time this view is given.
 */
export function BallView({ model }: BallViewBindings): Container {
    const view = new Container();
    const ball = new Graphics().circle(0, 0, model.radius).fill(0xffffff);
    view.addChild(ball);

    let flashMs = 0; // time left on a flash, counting down
    let seenBounces = model.bounces;

    setUpdate(view, (deltaMs) => {
        flashMs = Math.max(0, flashMs - deltaMs);
        if (model.bounces !== seenBounces) {
            seenBounces = model.bounces;
            flashMs = FLASH_MS;
        }
    });
    setRefresh(view, () => {
        ball.position.set(model.x, model.y);
        ball.tint = flashMs > 0 ? 0xffffff : 0x44aaff;
    });
    return view;
}
