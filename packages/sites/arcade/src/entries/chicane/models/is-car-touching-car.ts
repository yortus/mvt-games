import { CAR_HALF_LENGTH, CAR_HALF_WIDTH } from '../data';
import { isCircleTouchingCar } from './is-circle-touching-car';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Whether two cars overlap, each at its place and heading. The first car is
 * taken as three circles down its length, which fit its shape closely
 * enough, and each is tested against the second car's rectangle.
 */
export function isCarTouchingCar(
    aX: number,
    aZ: number,
    aHeading: number,
    bX: number,
    bZ: number,
    bHeading: number,
): boolean {
    // Too far apart to touch, whichever way they face, which most pairs are
    const dx = aX - bX;
    const dz = aZ - bZ;
    if (dx * dx + dz * dz > REACH * REACH) return false;
    const cos = Math.cos(aHeading);
    const sin = Math.sin(aHeading);
    for (let c = 0; c < CIRCLE_POSITIONS.length; c++) {
        const along = CIRCLE_POSITIONS[c];
        if (isCircleTouchingCar(aX + cos * along, aZ + sin * along, CAR_HALF_WIDTH, bX, bZ, bHeading)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the circles that stand in for the first car's shape sit, along its length. */
const CIRCLE_POSITIONS: readonly number[] = [-(CAR_HALF_LENGTH - CAR_HALF_WIDTH), 0, CAR_HALF_LENGTH - CAR_HALF_WIDTH];

/** A distance between two cars' middles that is safely more than any two touching cars can have, corner to corner. */
const REACH = (CAR_HALF_LENGTH + CAR_HALF_WIDTH) * 2;
