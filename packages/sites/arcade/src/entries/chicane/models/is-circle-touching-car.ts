import { CAR_HALF_LENGTH, CAR_HALF_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Whether a circle on the ground overlaps a car, which is a rectangle turned
 * to its heading. The circle is brought into the car's own frame, where the
 * car's sides line up with the axes, and the nearest point of the car to it
 * is the circle's centre clamped to the car's half length and half width.
 */
export function isCircleTouchingCar(
    circleX: number,
    circleZ: number,
    radius: number,
    carX: number,
    carZ: number,
    carHeading: number,
): boolean {
    const dx = circleX - carX;
    const dz = circleZ - carZ;
    const cos = Math.cos(carHeading);
    const sin = Math.sin(carHeading);
    const along = dx * cos + dz * sin;
    const across = -dx * sin + dz * cos;
    const nearestAlong = Math.max(-CAR_HALF_LENGTH, Math.min(CAR_HALF_LENGTH, along));
    const nearestAcross = Math.max(-CAR_HALF_WIDTH, Math.min(CAR_HALF_WIDTH, across));
    const gapAlong = along - nearestAlong;
    const gapAcross = across - nearestAcross;
    return gapAlong * gapAlong + gapAcross * gapAcross < radius * radius;
}
