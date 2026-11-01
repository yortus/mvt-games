// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the ship speeds up as it falls, in world units per ms, per ms. */
const GRAVITY = 0.0004;
/**
 * How fast the thrust speeds the ship up, upwards, in world units per ms,
 * per ms. It's stronger than gravity, so the ship climbs.
 */
const THRUST = 0.0009;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ship that falls, and thrusts upwards while the player holds the thrust
 * on. It knows nothing of keys or touches: only whether the player is
 * thrusting.
 */
export interface ShipModel {
    /** The ship's position, in world units. */
    readonly x: number;
    readonly y: number;
    /** Whether the player is holding the thrust on. */
    isThrusting: boolean;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    readonly startX: number;
    readonly startY: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship at its starting place, not moving, and not thrusting. */
export function createShipModel(options: ShipModelOptions): ShipModel {
    // Private state, inside the function
    const x = options.startX;
    let y = options.startY;
    let vy = 0;

    const model: ShipModel = {
        get x() { return x; },
        get y() { return y; },
        isThrusting: false,

        update(deltaMs) {
            const thrust = model.isThrusting ? THRUST : 0;
            vy += (GRAVITY - thrust) * deltaMs;
            y += vy * deltaMs;

            // The ground and the sky stop the ship
            if (y > GROUND_Y) {
                y = GROUND_Y;
                vy = 0;
            }
            if (y < SKY_Y) {
                y = SKY_Y;
                vy = 0;
            }
        },
    };
    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The lowest the ship's centre goes, where it stands on the ground, in world units. */
const GROUND_Y = 300;
/** The highest the ship's centre goes, in world units. */
const SKY_Y = 40;
