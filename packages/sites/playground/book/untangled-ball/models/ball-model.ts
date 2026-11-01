// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big the ball is, in world units. */
const RADIUS = 15;
/** How fast the ball speeds up as it falls, in world units per ms, per ms. */
const GRAVITY = 0.0015;
/** The share of its speed the ball keeps as it bounces, from 0 to 1. */
const BOUNCE = 0.7;
/** The slowest bounce, in world units per ms. A slower one leaves the ball resting. */
const REST_SPEED = 0.05;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ball that falls, bounces on the floor of a box, and comes to rest.
 * Positions are in world units, with the box's top left corner at 0, 0.
 */
export interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    /**
     * How many times the ball has bounced. A bounce starts and ends inside
     * one `update`, so the model counts them, and a view notices the count
     * rise.
     */
    readonly bounces: number;
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

/** Creates a ball a third of the way down the box, about to fall. */
export function createBallModel(options: BallModelOptions): BallModel {
    const { width, height } = options;
    const x = width / 2;
    let y = height / 3;
    let vy = 0; // world units per ms
    let bounces = 0;

    return {
        x,
        get y() { return y; },
        radius: RADIUS,
        get bounces() { return bounces; },

        update(deltaMs) {
            vy += GRAVITY * deltaMs;
            y += vy * deltaMs;

            if (y > height - RADIUS) {
                y = height - RADIUS;
                vy = -Math.abs(vy) * BOUNCE;
                // A ball barely bouncing comes to rest on the floor
                if (Math.abs(vy) < REST_SPEED) vy = 0;
                else bounces++;
            }
        },
    };
}
