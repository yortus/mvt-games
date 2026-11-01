import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { BallModel } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the flash lasts, in ms: about six ticks, at 60 frames a second. */
const FLASH_MS = 100;

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
 * The ball, which flashes white for a moment each time it bounces. The flash
 * is this view's own state: the game plays the same without it. It moves on
 * in the view's update step, with time from the ticker, so pausing or
 * stepping the game pauses or steps the flash too.
 */
export function BallView({ model }: BallViewBindings): Container {
    const view = new Container();
    // Drawn white once, and tinted each refresh
    const ball = new Graphics().circle(0, 0, model.radius).fill(0xffffff);
    view.addChild(ball);

    // Presentation state: the time left on the flash, counting down
    let flashMs = 0;
    let seenBounces = model.bounces;

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        flashMs = Math.max(0, flashMs - deltaMs);
        // A bounce since the last update starts the flash again
        if (model.bounces !== seenBounces) {
            seenBounces = model.bounces;
            flashMs = FLASH_MS;
        }
    }

    function refresh(): void {
        ball.position.set(model.x, model.y);
        ball.tint = flashMs > 0 ? 0xffffff : 0x44aaff;
    }
}
