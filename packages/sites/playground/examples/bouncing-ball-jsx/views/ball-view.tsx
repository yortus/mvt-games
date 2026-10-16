/** @jsxImportSource @mvtjs/pixi */

import { type Container, type FederatedPointerEvent, type Graphics, Rectangle } from 'pixi.js';
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
 * The ball, and its shadow on the floor, which grows wider and darker as the
 * ball comes down. Both are drawn once. Each frame, attributes given as
 * functions move, scale and fade them, and show the held ball or the free
 * one. Press on the ball to grab it, drag it, and let go to throw it.
 */
export function BallView({ model, width, height }: BallViewBindings): Container {
    // The radius never changes, so the ball and shadow are drawn once at this size
    const radius = model.radius;
    // 1 with the ball on the floor, less as it rises
    const nearness = (): number => 1 - (height - model.y) / (height * 4 / 3);

    // The whole box takes the pointer, so a drag can leave the ball behind
    return (
        <container
            hitArea={new Rectangle(0, 0, width, height)}
            onPointerDown={(e: FederatedPointerEvent) => model.grab(e.globalX, e.globalY)}
            onPointerMove={(e: FederatedPointerEvent) => model.drag(e.globalX, e.globalY)}
            onPointerUp={() => model.release()}
            onPointerUpOutside={() => model.release()}
        >
            <graphics
                x={() => model.x}
                y={height - radius * 0.3}
                scale={() => 0.6 + 0.4 * nearness()}
                alpha={() => 0.25 * (0.3 + 0.7 * nearness())}
                ref={(g) => g.ellipse(0, 0, radius, radius * 0.2).fill(0x000000)}
            />
            <container x={() => model.x} y={() => model.y}>
                <graphics visible={() => !model.isHeld} ref={(g) => drawBall(g, radius, false)} />
                <graphics visible={() => model.isHeld} ref={(g) => drawBall(g, radius, true)} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawBall(g: Graphics, radius: number, isHeld: boolean): void {
    g.circle(0, 0, radius).fill(isHeld ? 0x66ccff : 0x44aaff);
    // A highlight
    g.circle(-4, -4, radius * 0.35).fill({ color: 0xffffff, alpha: 0.4 });
    if (isHeld) g.circle(0, 0, radius + 3).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
}
