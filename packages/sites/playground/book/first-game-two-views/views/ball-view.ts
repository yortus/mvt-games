import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BallModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BallViewBindings {
    model: BallModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ball, drawn where the model says it is. One world unit is drawn as
 * one pixel, but that's this view's choice: the model doesn't know.
 */
export function BallView(bindings: BallViewBindings): Container {
    const { model } = bindings;
    const view = new Container();
    const ball = new Graphics()
        .circle(0, 0, model.radius)
        .fill(0x44aaff);
    view.addChild(ball);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        ball.position.set(model.x, model.y);
    }
}
