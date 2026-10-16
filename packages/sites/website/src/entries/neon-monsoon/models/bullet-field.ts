import type { BulletMotion } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Every bullet of one side, up to a few thousand, in one model.
 *
 * Bullets are not objects. Each field of a bullet is an entry in a typed
 * array, and a bullet is an index into them, so firing, moving and removing
 * bullets allocates nothing, and a step is a tight loop over numbers. Read a
 * bullet's fields by its index, as `xOf(i)`.
 *
 * Live bullets are packed at indices `0` to `count - 1`. Removing one moves
 * the last bullet into its place, so **a bullet's index can change from one
 * step to the next**: nothing outside may keep anything per index. A view
 * shows bullet `i` from its fields alone, each frame.
 *
 * Generic over the kinds of bullet it holds: the enemies' field holds
 * `BulletKind`s, the player's holds `ShotKind`s.
 */
export interface BulletField<K extends string> {
    /** Live bullets, at indices 0 to count - 1. */
    readonly count: number;
    readonly capacity: number;

    /** Position in world-units. Only meaningful for an index below `count`. */
    xOf: (index: number) => number;
    yOf: (index: number) => number;
    /** Direction of travel in radians, for bullets drawn pointing along it. */
    angleOf: (index: number) => number;
    kindOf: (index: number) => K;
    /** Milliseconds since it was fired. */
    ageOf: (index: number) => number;

    /**
     * Fire a bullet. Returns false, and fires nothing, when the field is full,
     * so an over-dense pattern thins out rather than failing. Takes positional
     * parameters, unlike the factories, since it runs thousands of times a
     * second and an options object per call would be garbage.
     */
    fire: (x: number, y: number, angle: number, kind: K, motion: BulletMotion, speedScale?: number) => boolean;
    /** Remove the bullet at `index`; the last bullet moves into its place. */
    remove: (index: number) => void;
    /**
     * Remove every bullet, calling `onEach` with each one's position first,
     * such as to turn the bullets into gems.
     */
    clear: (onEach?: (x: number, y: number) => void) => void;

    /**
     * The index of a bullet touching a circle at (x, y), counting the bullet's
     * own hit radius, or -1 for none. Finds one; it does not remove it.
     */
    findTouching: (x: number, y: number, radius: number) => number;
    /**
     * Mark every bullet touching a circle at (x, y) as grazed, and return how
     * many had not been grazed before. Each bullet counts once.
     */
    markGrazed: (x: number, y: number, radius: number) => number;

    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BulletFieldOptions<K extends string> {
    readonly capacity: number;
    /** Every kind of bullet the field holds, with its hit radius in world-units. */
    readonly hitRadii: Readonly<Record<K, number>>;
    /** The arena's size; bullets `margin` outside it are removed. */
    readonly width: number;
    readonly height: number;
    readonly margin: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletField<K extends string>(options: BulletFieldOptions<K>): BulletField<K> {
    const { capacity, hitRadii, width, height, margin } = options;

    // Kinds are stored as small numbers, an index into `kinds`.
    const kinds = Object.keys(hitRadii) as K[];
    const codeOf = new Map<K, number>();
    const radiusOfCode = new Float64Array(kinds.length);
    for (let code = 0; code < kinds.length; code++) {
        codeOf.set(kinds[code], code);
        radiusOfCode[code] = hitRadii[kinds[code]];
    }

    // One array per field. Velocity is cached from speed and angle, and only
    // recomputed for a bullet that is turning or changing speed.
    const xs = new Float64Array(capacity);
    const ys = new Float64Array(capacity);
    const vxs = new Float64Array(capacity);
    const vys = new Float64Array(capacity);
    const angles = new Float64Array(capacity);
    const speeds = new Float64Array(capacity);
    const endSpeeds = new Float64Array(capacity);
    const accels = new Float64Array(capacity);
    const turnRates = new Float64Array(capacity);
    const turnMsLeft = new Float64Array(capacity);
    const ages = new Float64Array(capacity);
    const kindCodes = new Uint8Array(capacity);
    const isGrazed = new Uint8Array(capacity);

    const minX = -margin;
    const maxX = width + margin;
    const minY = -margin;
    const maxY = height + margin;

    let count = 0;

    const field: BulletField<K> = {
        get count() {
            return count;
        },
        capacity,

        xOf: (index) => xs[index],
        yOf: (index) => ys[index],
        angleOf: (index) => angles[index],
        kindOf: (index) => kinds[kindCodes[index]],
        ageOf: (index) => ages[index],

        fire(x, y, angle, kind, motion, speedScale = 1) {
            if (count === capacity) return false;
            const i = count++;
            const speed = motion.speed * speedScale;
            xs[i] = x;
            ys[i] = y;
            angles[i] = angle;
            speeds[i] = speed;
            endSpeeds[i] = (motion.endSpeed ?? motion.speed) * speedScale;
            accels[i] = (motion.accel ?? 0) * speedScale;
            turnRates[i] = (motion.turnDegPerSec ?? 0) * DEG_TO_RAD;
            turnMsLeft[i] = motion.turnMs ?? Infinity;
            ages[i] = 0;
            kindCodes[i] = codeOf.get(kind) ?? 0;
            isGrazed[i] = 0;
            vxs[i] = Math.cos(angle) * speed;
            vys[i] = Math.sin(angle) * speed;
            return true;
        },

        remove,

        clear(onEach) {
            if (onEach !== undefined) {
                for (let i = 0; i < count; i++) onEach(xs[i], ys[i]);
            }
            count = 0;
        },

        findTouching(x, y, radius) {
            for (let i = 0; i < count; i++) {
                const reach = radius + radiusOfCode[kindCodes[i]];
                const dx = xs[i] - x;
                const dy = ys[i] - y;
                if (dx * dx + dy * dy < reach * reach) return i;
            }
            return -1;
        },

        markGrazed(x, y, radius) {
            let grazed = 0;
            for (let i = 0; i < count; i++) {
                if (isGrazed[i] === 1) continue;
                const reach = radius + radiusOfCode[kindCodes[i]];
                const dx = xs[i] - x;
                const dy = ys[i] - y;
                if (dx * dx + dy * dy < reach * reach) {
                    isGrazed[i] = 1;
                    grazed++;
                }
            }
            return grazed;
        },

        update(deltaMs) {
            const dt = deltaMs * 0.001;
            // Backwards, so the bullet a removal moves into `i` has already
            // been stepped, and none is skipped or stepped twice.
            for (let i = count - 1; i >= 0; i--) {
                ages[i] += deltaMs;

                let isVelocityStale = false;
                if (turnRates[i] !== 0) {
                    angles[i] += turnRates[i] * dt;
                    turnMsLeft[i] -= deltaMs;
                    if (turnMsLeft[i] <= 0) turnRates[i] = 0;
                    isVelocityStale = true;
                }
                if (speeds[i] !== endSpeeds[i]) {
                    speeds[i] = approach(speeds[i], endSpeeds[i], accels[i] * dt);
                    isVelocityStale = true;
                }
                if (isVelocityStale) {
                    vxs[i] = Math.cos(angles[i]) * speeds[i];
                    vys[i] = Math.sin(angles[i]) * speeds[i];
                }

                const x = (xs[i] += vxs[i] * dt);
                const y = (ys[i] += vys[i] * dt);
                if (x < minX || x > maxX || y < minY || y > maxY) remove(i);
            }
        },
    };

    return field;

    function remove(index: number): void {
        const last = --count;
        if (index === last) return;
        xs[index] = xs[last];
        ys[index] = ys[last];
        vxs[index] = vxs[last];
        vys[index] = vys[last];
        angles[index] = angles[last];
        speeds[index] = speeds[last];
        endSpeeds[index] = endSpeeds[last];
        accels[index] = accels[last];
        turnRates[index] = turnRates[last];
        turnMsLeft[index] = turnMsLeft[last];
        ages[index] = ages[last];
        kindCodes[index] = kindCodes[last];
        isGrazed[index] = isGrazed[last];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;

/** Move `value` toward `target` by at most `step`, without overshooting. */
function approach(value: number, target: number, step: number): number {
    if (step <= 0) return target;
    return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
