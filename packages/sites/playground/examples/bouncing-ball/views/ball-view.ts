import { Container, Graphics, Rectangle } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BallModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BallViewBindings {
    readonly model: BallModel;
    /** The size of the box, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ball, and its shadow on the floor, which grows darker as the ball
 * comes down. Press on the ball to grab it, drag it, and let go to throw it.
 */
export function BallView({ model, width, height }: BallViewBindings): Container {
    const view = new Container();
    const shadow = new Graphics();
    const ball = new Graphics();
    view.addChild(shadow, ball);

    // The whole box takes the pointer, so a drag can leave the ball behind
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerdown', (e) => model.grab(e.globalX, e.globalY));
    view.on('pointermove', (e) => model.drag(e.globalX, e.globalY));
    view.on('pointerup', () => model.release());
    view.on('pointerupoutside', () => model.release());

    let wasHeld = model.isHeld;
    drawBall(wasHeld);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        ball.position.set(model.x, model.y);
        if (model.isHeld !== wasHeld) {
            wasHeld = model.isHeld;
            drawBall(wasHeld);
        }

        // 1 with the ball on the floor, less as it rises
        const nearness = 1 - (height - model.y) / (height * 4 / 3);
        shadow.clear();
        shadow.ellipse(model.x, height - model.radius * 0.3, model.radius * (0.6 + 0.4 * nearness), model.radius * 0.2);
        shadow.fill({ color: 0x000000, alpha: 0.25 * (0.3 + 0.7 * nearness) });
    }

    function drawBall(isHeld: boolean): void {
        ball.clear();
        ball.circle(0, 0, model.radius).fill(isHeld ? 0x66ccff : 0x44aaff);
        // A highlight
        ball.circle(-4, -4, model.radius * 0.35).fill({ color: 0xffffff, alpha: 0.4 });
        if (isHeld) ball.circle(0, 0, model.radius + 3).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
    }
}
