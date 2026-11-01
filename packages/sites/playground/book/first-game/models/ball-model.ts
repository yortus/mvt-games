// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big the ball is, in world units. */
const RADIUS = 15;
/** How fast the ball speeds up as it falls, in world units per ms, per ms. */
const GRAVITY = 0.0015;
/** The share of its speed the ball keeps as it bounces, from 0 to 1. */
const BOUNCE = 0.7;
/** How fast the ball starts moving to the right, in world units per ms. */
const START_SPEED = 0.12;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ball that falls, and bounces off the floor and the walls of a box.
 * Positions are in world units, with the box's top left corner at 0, 0.
 */
export interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
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
export function createBallModel(options: BallModelOptions): BallModel {
    const { width, height } = options;
    let x = width / 2;
    let y = height / 3;
    let vx = START_SPEED; // world units per ms
    let vy = 0;

    return {
        get x() { return x; },
        get y() { return y; },
        radius: RADIUS,

        update(deltaMs) {
            vy += GRAVITY * deltaMs;
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
            if (y > height - RADIUS) {
                y = height - RADIUS;
                vy = -Math.abs(vy) * BOUNCE;
            }
        },
    };
}
