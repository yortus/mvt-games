// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many lives a ship starts with, and starts again with. */
const STARTING_LIVES = 5;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A player's ship, which plays itself: it loses a life at a steady rate,
 * and when the last one goes, it starts again with all five.
 */
export interface ShipModel {
    readonly lives: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    /** How often the ship loses a life, in ms. */
    readonly lifeLostEveryMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship with all its lives. */
export function createShipModel({ lifeLostEveryMs }: ShipModelOptions): ShipModel {
    let lives = STARTING_LIVES;
    let elapsedMs = 0;

    const model: ShipModel = {
        get lives() { return lives; },

        update(deltaMs) {
            elapsedMs += deltaMs;
            if (elapsedMs < lifeLostEveryMs) return;
            elapsedMs -= lifeLostEveryMs;
            lives = lives > 0 ? lives - 1 : STARTING_LIVES;
        },
    };

    return model;
}
