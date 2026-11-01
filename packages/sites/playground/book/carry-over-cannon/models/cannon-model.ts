// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How often the cannon fires, in ms. */
export const FIRE_EVERY_MS = 250;
/** How fast a ball flies, in metres per second. */
export const BALL_SPEED = 10;
/** How far a ball flies before it's gone, in metres. */
export const RANGE = 20;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CannonModel {
    /** How far each ball in the air has flown, in metres, the oldest first. */
    readonly balls: readonly number[];
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a cannon that fires a ball every `FIRE_EVERY_MS`, or tries to.
 * Like the chapter's banner, it starts its timer again from 0 when it
 * fires, so it drops the part of the step after the shot came due, and one
 * update fires at most one ball. So it fires late, by up to a step each
 * time, and how late depends on the step size.
 */
export function createCannonModel(): CannonModel {
    const balls: number[] = [];
    let elapsedMs = 0;

    return {
        balls,

        update(deltaMs) {
            flyBalls(balls, deltaMs);
            elapsedMs += deltaMs;
            if (elapsedMs >= FIRE_EVERY_MS) {
                balls.push(0);
                elapsedMs = 0;
            }
        },
    };
}

/** Moves each ball on by `deltaMs` of flight, and drops the ones that have flown out of range. */
export function flyBalls(balls: number[], deltaMs: number): void {
    for (let i = 0; i < balls.length; i++) balls[i] += (BALL_SPEED * deltaMs) / 1000;
    while (balls.length > 0 && balls[0] > RANGE) balls.shift();
}
