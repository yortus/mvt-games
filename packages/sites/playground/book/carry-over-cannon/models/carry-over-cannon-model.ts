// The cannon's numbers, from the plain cannon's file, so both cannons keep the same ones
import { BALL_SPEED, type CannonModel, FIRE_EVERY_MS, flyBalls, RANGE } from './cannon-model';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a cannon like `createCannonModel`, but one that keeps time at
 * any step size. It carries the time left over when it fires into its
 * timer, and fires every shot that came due during an update. Each ball
 * starts as far along as it would have flown since its shot came due, so
 * a step of any size leaves the balls where many small steps that add up
 * to the same time would.
 */
export function createCarryOverCannonModel(): CannonModel {
    const balls: number[] = [];
    let elapsedMs = 0;

    return {
        balls,

        update(deltaMs) {
            flyBalls(balls, deltaMs);
            elapsedMs += deltaMs;
            while (elapsedMs >= FIRE_EVERY_MS) {
                elapsedMs -= FIRE_EVERY_MS;
                // The shot came due elapsedMs ago, so its ball has been flying that long
                const distance = (BALL_SPEED * elapsedMs) / 1000;
                if (distance <= RANGE) balls.push(distance);
            }
        },
    };
}
