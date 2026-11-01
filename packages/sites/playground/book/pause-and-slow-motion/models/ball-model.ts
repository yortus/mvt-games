// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big the ball is, in world units. */
const RADIUS = 15;
/** How fast the ball speeds up as it falls, in world units per ms, per ms. */
const GRAVITY = 0.0015;
/** How fast the ball moves sideways, in world units per ms. */
const SIDEWAYS_SPEED = 0.2;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ball that bounces around a box forever, losing no speed. Positions are
 * in world units, with the box's top left corner at 0, 0. It knows nothing
 * about pausing or slow motion: it only moves on by the `deltaMs` it's given.
 */
export interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    /** How many times the ball has bounced on the floor. */
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

/** Creates a ball near the top left of the box, moving to the right. */
export function createBallModel(options: BallModelOptions): BallModel {
    const { width, height } = options;
    let x = width / 4;
    let y = height / 4;
    let vx = SIDEWAYS_SPEED; // world units per ms
    let vy = 0;
    let bounces = 0;

    return {
        get x() { return x; },
        get y() { return y; },
        radius: RADIUS,
        get bounces() { return bounces; },

        update(deltaMs) {
            vy += GRAVITY * deltaMs;
            x += vx * deltaMs;
            y += vy * deltaMs;

            if (x < RADIUS) {
                x = RADIUS;
                vx = Math.abs(vx);
            }
            if (x > width - RADIUS) {
                x = width - RADIUS;
                vx = -Math.abs(vx);
            }
            if (y > height - RADIUS) {
                y = height - RADIUS;
                vy = -Math.abs(vy);
                bounces++;
            }
        },
    };
}
