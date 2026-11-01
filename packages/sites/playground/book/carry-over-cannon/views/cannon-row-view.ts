import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** A ball's radius, in pixels. */
const BALL_RADIUS = 7;
/** A ring's radius, in pixels: a little bigger than a ball, so a ball on its ring sits inside it. */
const RING_RADIUS = 11;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CannonRowViewBindings {
    /** A few words that say which cannon this is. */
    readonly label: string;
    /** The label's and the balls' colour, such as `0x66dd88`. */
    readonly color: number;
    /** How far the balls fly before they're gone, in metres. Read once. */
    readonly range: number;
    /** How far each ball has flown, in metres. */
    readonly balls: () => readonly number[];
    /** Where the same cannon's balls would be, had it been given small steps, in metres. Drawn as rings. */
    readonly smallStepBalls: () => readonly number[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A cannon on the left, firing balls to the right, with its label above.
 * Each ball is a dot, and a ring shows where small steps would have put
 * it. The view's origin is its top-left corner.
 */
export function CannonRowView(bindings: CannonRowViewBindings): Container {
    const { range, color } = bindings;
    const view = new Container();
    const label = new Text({
        text: bindings.label,
        style: { fontFamily: 'monospace', fontSize: 16, fill: color },
    });
    label.x = 20;
    const track = new Graphics()
        .moveTo(TRACK_LEFT, TRACK_Y + RING_RADIUS + 4)
        .lineTo(TRACK_RIGHT, TRACK_Y + RING_RADIUS + 4)
        .stroke({ color: 0x33445e, width: 2 });
    const cannon = new Graphics()
        .roundRect(TRACK_LEFT - 44, TRACK_Y - 9, 40, 18, 4)
        .fill(0x8899aa)
        .circle(TRACK_LEFT - 34, TRACK_Y + 10, 9)
        .fill(0x5a6b85);
    view.addChild(label, track, cannon);

    // Made once, and moved, shown or hidden as the balls fly
    const rings: Graphics[] = [];
    const dots: Graphics[] = [];
    for (let i = 0; i < MOST_BALLS; i++) {
        const ring = new Graphics().circle(0, 0, RING_RADIUS).stroke({ color: 0x8899aa, width: 2, alpha: 0.6 });
        ring.y = TRACK_Y;
        rings.push(ring);
        view.addChild(ring);
    }
    for (let i = 0; i < MOST_BALLS; i++) {
        const dot = new Graphics().circle(0, 0, BALL_RADIUS).fill(color);
        dot.y = TRACK_Y;
        dots.push(dot);
        view.addChild(dot);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        placeBalls(rings, bindings.smallStepBalls());
        placeBalls(dots, bindings.balls());
    }

    function placeBalls(shapes: readonly Graphics[], balls: readonly number[]): void {
        for (let i = 0; i < shapes.length; i++) {
            const isInUse = i < balls.length;
            shapes[i].visible = isInUse;
            if (isInUse) shapes[i].x = TRACK_LEFT + (balls[i] / range) * (TRACK_RIGHT - TRACK_LEFT);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most balls the view draws of each kind, more than the cannon can have in the air. */
const MOST_BALLS = 16;
/** Where a ball at 0 metres and one at the end of its range are drawn, in pixels. */
const TRACK_LEFT = 80;
const TRACK_RIGHT = 620;
/** The height of the balls' centres, in pixels, below the view's top. */
const TRACK_Y = 48;
