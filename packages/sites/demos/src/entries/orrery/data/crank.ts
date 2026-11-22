// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** The teeth on the pinion that the crank turns. Each tooth that passes makes the mechanism tick. */
export const CRANK_PINION_TEETH = 24;

/** The teeth on the wheel on the drive arbor that the crank's pinion turns. With the pinion's, they add up to `WORLD_PAIR_TEETH`. */
export const DRIVE_WHEEL_TEETH = 36;

/** How fast the clockwork motor turns the crank at the start, in turns a second. */
export const STARTING_TURNS_PER_SECOND = 0.25;

/** The fastest the motor can be set to turn the crank, either way, in turns a second. */
export const MAX_TURNS_PER_SECOND = 3;

/**
 * How quickly the crank's speed follows a change to the motor's. In this
 * time, its speed closes about two thirds of the gap, so the mechanism
 * winds up and down like something with weight, not all at once.
 */
export const SETTLE_MS = 400;
