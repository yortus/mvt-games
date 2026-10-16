// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ball that falls, bounces off the walls of a box, and slows with
 * friction. It can be grabbed, dragged and thrown. Positions are in world
 * units, with the box's top left corner at 0, 0.
 */
export interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    /** Whether the ball is held, and so follows the pointer instead of falling. */
    readonly isHeld: boolean;
    /** Grabs the ball, if the point is on it or close to it. */
    readonly grab: (x: number, y: number) => void;
    /** Moves a held ball to the point, kept inside the box. */
    readonly drag: (x: number, y: number) => void;
    /** Lets go of a held ball, which keeps the speed it was dragged at. */
    readonly release: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BallModelOptions {
    /** The width of the box, in world units. */
    readonly width: number;
    /** The height of the box, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ball near the top of the box, moving to the right. */
export function createBallModel({ width, height }: BallModelOptions): BallModel {
    let x = width / 2;
    let y = height / 3;
    let vx = 0.12;
    let vy = 0;
    let isHeld = false;
    // Where a held ball was before its last drag, and how long that drag's tick took, for the speed of a throw
    let previousX = 0;
    let previousY = 0;
    let dragMs = 0;

    const model: BallModel = {
        get x() { return x; },
        get y() { return y; },
        radius: RADIUS,
        get isHeld() { return isHeld; },

        grab(px, py) {
            const reach = RADIUS + GRAB_MARGIN;
            if ((px - x) ** 2 + (py - y) ** 2 > reach * reach) return;
            isHeld = true;
            vx = 0;
            vy = 0;
            previousX = x;
            previousY = y;
            dragMs = 0;
        },

        drag(px, py) {
            if (!isHeld) return;
            previousX = x;
            previousY = y;
            x = clamp(px, RADIUS, width - RADIUS);
            y = clamp(py, RADIUS, height - RADIUS);
        },

        release() {
            if (!isHeld) return;
            isHeld = false;
            if (dragMs > 0) {
                vx = (x - previousX) / dragMs;
                vy = (y - previousY) / dragMs;
            }
        },

        update(deltaMs) {
            if (isHeld) {
                dragMs = deltaMs;
                return;
            }
            vy += GRAVITY * deltaMs;
            const friction = FRICTION ** deltaMs;
            vx *= friction;
            vy *= friction;
            x += vx * deltaMs;
            y += vy * deltaMs;

            if (x < RADIUS) {
                x = RADIUS;
                vx = Math.abs(vx) * BOUNCE;
            }
            if (x > width - RADIUS) {
                x = width - RADIUS;
                vx = -Math.abs(vx) * BOUNCE;
            }
            if (y < RADIUS) {
                y = RADIUS;
                vy = Math.abs(vy) * BOUNCE;
            }
            if (y > height - RADIUS) {
                y = height - RADIUS;
                vy = -Math.abs(vy) * BOUNCE;
            }

            // A ball barely bouncing comes to rest on the floor
            if (y >= height - RADIUS - 1 && Math.abs(vy) < 0.01) {
                vy = 0;
                y = height - RADIUS;
            }
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RADIUS = 15;
/** How far outside the ball a grab still catches it. */
const GRAB_MARGIN = 8;
/** In world units per ms, per ms. */
const GRAVITY = 0.0015;
/** The share of its speed the ball keeps as it bounces. */
const BOUNCE = 0.7;
/** The share of its speed the ball keeps each ms. */
const FRICTION = 0.998;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
