// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Score gems: what cancelled bullets turn into. A gem floats up for a moment,
 * then flies to the ship, faster and faster, to be collected.
 *
 * Laid out like `BulletField`, one typed array per field, packed, and removed
 * by swapping with the last, so indices change from step to step: read a
 * gem's fields by its index, each frame.
 */
export interface GemField {
    /** Live gems, at indices 0 to count - 1. */
    readonly count: number;
    readonly capacity: number;
    /** Position in world-units. Only meaningful for an index below `count`. */
    xOf: (index: number) => number;
    yOf: (index: number) => number;
    ageOf: (index: number) => number;
    /** Add a gem; false when full. */
    spawn: (x: number, y: number) => boolean;
    /** Collect every gem within `radius` of (x, y): remove them, and return how many. */
    collectTouching: (x: number, y: number, radius: number) => number;
    clear: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GemFieldOptions {
    readonly capacity: number;
    /** What gems fly to, read every step. While it is not alive, gems drift up and away. */
    readonly target: GemTarget;
    /** Gems this far above the arena are removed. */
    readonly margin: number;
}

/** The ship, as far as gems are concerned. */
export interface GemTarget {
    readonly x: number;
    readonly y: number;
    readonly isAlive: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGemField(options: GemFieldOptions): GemField {
    const { capacity, target, margin } = options;

    const xs = new Float64Array(capacity);
    const ys = new Float64Array(capacity);
    const ages = new Float64Array(capacity);
    let count = 0;

    const field: GemField = {
        get count() {
            return count;
        },
        capacity,
        xOf: (index) => xs[index],
        yOf: (index) => ys[index],
        ageOf: (index) => ages[index],

        spawn(x, y) {
            if (count === capacity) return false;
            xs[count] = x;
            ys[count] = y;
            ages[count] = 0;
            count++;
            return true;
        },

        collectTouching(x, y, radius) {
            const reachSq = radius * radius;
            let collected = 0;
            for (let i = count - 1; i >= 0; i--) {
                const dx = xs[i] - x;
                const dy = ys[i] - y;
                if (dx * dx + dy * dy < reachSq) {
                    remove(i);
                    collected++;
                }
            }
            return collected;
        },

        clear() {
            count = 0;
        },

        update(deltaMs) {
            const dt = deltaMs * 0.001;
            const isHoming = target.isAlive;
            const targetX = target.x;
            const targetY = target.y;
            for (let i = count - 1; i >= 0; i--) {
                const age = (ages[i] += deltaMs);
                if (!isHoming || age < FLOAT_MS) {
                    ys[i] -= FLOAT_SPEED * dt;
                    if (ys[i] < -margin) remove(i);
                    continue;
                }
                // Home in, speeding up the longer the gem has been flying.
                const speed = Math.min(MAX_HOMING_SPEED, (age - FLOAT_MS) * HOMING_ACCEL);
                const dx = targetX - xs[i];
                const dy = targetY - ys[i];
                const distance = Math.sqrt(dx * dx + dy * dy);
                const travel = Math.min(distance, speed * dt);
                if (distance > 0) {
                    xs[i] += (dx / distance) * travel;
                    ys[i] += (dy / distance) * travel;
                }
            }
        },
    };

    return field;

    function remove(index: number): void {
        const last = --count;
        xs[index] = xs[last];
        ys[index] = ys[last];
        ages[index] = ages[last];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a new gem floats before it homes in. */
const FLOAT_MS = 300;
const FLOAT_SPEED = 25;
/** World-units per second gained for each millisecond of homing. */
const HOMING_ACCEL = 0.9;
const MAX_HOMING_SPEED = 600;
