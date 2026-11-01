// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the ball rolls, in world units per ms. */
const SPEED = 0.2;
/** How big the ball is, in world units. */
const RADIUS = 12;
/** How thick each wall is, in world units. The thinner the wall, the smaller the step that can jump it. */
const WALL_THICKNESS = 8;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ball that rolls to and fro along a lane, between two thin walls. Its
 * position is in world units. It checks for a wall only at the end of each
 * step, so it's sure to catch one only in steps shorter than 160 ms, well
 * over the ticker's 100 ms cap. A longer step can carry the ball further
 * than a wall's thickness and its own width, straight through the wall.
 */
export interface BallModel {
    /** The ball's centre, in world units along the lane. */
    readonly x: number;
    readonly radius: number;
    /** Where each wall's centre is, in world units along the lane. */
    readonly leftWall: number;
    readonly rightWall: number;
    /** How thick each wall is, in world units. */
    readonly wallThickness: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BallModelOptions {
    /** Where each wall's centre is, in world units along the lane. */
    readonly leftWall: number;
    readonly rightWall: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ball halfway between the walls, rolling to the right. */
export function createBallModel(options: BallModelOptions): BallModel {
    const { leftWall, rightWall } = options;
    let x = (leftWall + rightWall) / 2;
    let vx = SPEED;

    return {
        get x() { return x; },
        radius: RADIUS,
        leftWall,
        rightWall,
        wallThickness: WALL_THICKNESS,

        update(deltaMs) {
            x += vx * deltaMs;
            // The ball turns back from a wall it's touching. A step that
            // carries it right past a wall never touches it.
            if (vx > 0 && isTouching(rightWall)) vx = -vx;
            if (vx < 0 && isTouching(leftWall)) vx = -vx;
        },
    };

    function isTouching(wall: number): boolean {
        return x + RADIUS > wall - WALL_THICKNESS / 2 && x - RADIUS < wall + WALL_THICKNESS / 2;
    }
}
