// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many floors the building has, the ground floor (0) included. */
const FLOOR_COUNT = 6;
/** The floors the lift stops at, in order, round and round. Each is below FLOOR_COUNT. */
const STOPS: readonly number[] = [3, 1, 5, 0, 4, 2];
/** How fast the lift moves, in floors per ms. */
const SPEED = 0.0015;
/** How long the lift waits at each stop, in ms. */
const WAIT_MS = 1000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the lift is on its way to a floor, or waiting at one with its doors open. */
export type LiftPhase = 'moving' | 'waiting';

/** Which way the lift is going. */
export type LiftDirection = 'up' | 'down' | 'none';

/**
 * A lift that runs on its own, round a fixed list of stops. It moves at a
 * steady speed, and waits at each stop with its doors open. Its position is
 * in floors, not pixels: 0 is the ground floor, and 2.5 is halfway between
 * the second floor and the third.
 */
export interface LiftModel {
    /** How many floors the building has, the ground floor included. */
    readonly floorCount: number;
    readonly floor: number;
    readonly phase: LiftPhase;
    readonly direction: LiftDirection;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a lift on the ground floor, setting off for its first stop. */
export function createLiftModel(): LiftModel {
    let floor = 0;
    let stopIndex = 0;
    let phase: LiftPhase = 'moving';
    let waitedMs = 0;

    const model: LiftModel = {
        floorCount: FLOOR_COUNT,
        get floor() { return floor; },
        get phase() { return phase; },
        get direction() {
            if (phase === 'waiting') return 'none';
            return STOPS[stopIndex] > floor ? 'up' : 'down';
        },

        update(deltaMs) {
            if (phase === 'waiting') {
                waitedMs += deltaMs;
                if (waitedMs >= WAIT_MS) {
                    stopIndex = (stopIndex + 1) % STOPS.length;
                    phase = 'moving';
                }
                return;
            }

            const target = STOPS[stopIndex];
            const distance = SPEED * deltaMs;
            if (Math.abs(target - floor) <= distance) {
                floor = target;
                phase = 'waiting';
                waitedMs = 0;
            }
            else {
                floor += Math.sign(target - floor) * distance;
            }
        },
    };

    return model;
}
