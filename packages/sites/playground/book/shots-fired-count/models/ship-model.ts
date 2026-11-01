// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast a bullet flies, in world units per ms. */
const BULLET_SPEED = 0.4;
/** How long a shot keeps the ship in its firing phase, in ms. */
const FIRING_MS = 300;
/** How often the ship fires its double shot on its own, in ms. */
const CYCLE_MS = 1600;
/** When, in each cycle, the double shot's two shots are fired, in ms. Each is less than CYCLE_MS. */
const AUTO_SHOTS_MS: readonly number[] = [400, 550];

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the ship is just flying, or has fired in the last moment. */
export type ShipPhase = 'flying' | 'firing';

/**
 * A ship that fires straight up. It fires a double shot every so often on
 * its own, and the player can fire more. Each shot puts the ship in its
 * `'firing'` phase for a moment, and a shot fired in that moment keeps it
 * there, so the phase doesn't change for every shot. The count does.
 * Positions are in world units, with the play area's top left corner at 0, 0.
 */
export interface ShipModel {
    readonly x: number;
    readonly y: number;
    readonly phase: ShipPhase;
    /** How many shots the ship has fired. It goes up by one with each shot. */
    readonly shotsFired: number;
    /** The bullets in flight, oldest first. */
    readonly bullets: readonly Bullet[];
    readonly fire: () => void;
    readonly update: (deltaMs: number) => void;
}

/** A bullet in flight. */
export interface Bullet {
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    /** Where the ship is. */
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship, flying, that hasn't fired yet. */
export function createShipModel({ x, y }: ShipModelOptions): ShipModel {
    let phase: ShipPhase = 'flying';
    let shotsFired = 0;
    let firingMs = 0;
    let cycleMs = 0;
    const bullets: { x: number; y: number }[] = [];

    const model: ShipModel = {
        x,
        y,
        get phase() { return phase; },
        get shotsFired() { return shotsFired; },
        bullets,

        fire() {
            shotsFired += 1;
            bullets.push({ x, y: y - 16 });
            phase = 'firing';
            firingMs = 0;
        },

        update(deltaMs) {
            for (let i = bullets.length - 1; i >= 0; i--) {
                bullets[i].y -= BULLET_SPEED * deltaMs;
                if (bullets[i].y < 0) bullets.splice(i, 1);
            }

            if (phase === 'firing') {
                firingMs += deltaMs;
                if (firingMs >= FIRING_MS) phase = 'flying';
            }

            // The double shot, fired on its own once in each cycle
            const before = cycleMs;
            cycleMs = (cycleMs + deltaMs) % CYCLE_MS;
            for (let i = 0; i < AUTO_SHOTS_MS.length; i++) {
                const shotMs = AUTO_SHOTS_MS[i];
                const isDue = before <= cycleMs ? before < shotMs && shotMs <= cycleMs : before < shotMs || shotMs <= cycleMs;
                if (isDue) model.fire();
            }
        },
    };

    return model;
}
