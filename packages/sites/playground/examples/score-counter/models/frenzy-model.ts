// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A game of hitting targets. Targets appear at random places and escape
 * after a while. Each hit scores points, multiplied by a combo that grows
 * with each hit in a row. A miss, an escaped target, or a long wait ends the
 * combo. Positions are in world units, with the play area's top left corner
 * at 0, 0.
 */
export interface FrenzyModel {
    readonly score: number;
    /** How many hits in a row, with no miss between them. */
    readonly combo: number;
    /** The targets up now, oldest first. */
    readonly targets: readonly Target[];
    /** How long since the last hit, in ms. */
    readonly msSinceHit: number;
    /** Hits the target at the point, if there is one. Otherwise it is a miss, which ends the combo. */
    readonly hit: (x: number, y: number) => void;
    readonly update: (deltaMs: number) => void;
}

/** A target, which escapes when its age reaches its lifespan. */
export interface Target {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    /** How long the target has been up, in ms. */
    readonly ageMs: number;
    /** How long the target stays up before it escapes, in ms. */
    readonly lifespanMs: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FrenzyModelOptions {
    /** The width of the play area, in world units. */
    readonly width: number;
    /** The height of the play area, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game with a score of 0 and two targets up. */
export function createFrenzyModel({ width, height }: FrenzyModelOptions): FrenzyModel {
    let score = 0;
    let combo = 0;
    let msSinceHit = 0;
    let msSinceSpawn = 0;
    const targets: MutableTarget[] = [];

    spawnTarget();
    spawnTarget();

    const model: FrenzyModel = {
        get score() { return score; },
        get combo() { return combo; },
        targets,
        get msSinceHit() { return msSinceHit; },

        hit(x, y) {
            // The newest target is on top, so it is the one hit
            for (let i = targets.length - 1; i >= 0; i--) {
                const target = targets[i];
                if ((x - target.x) ** 2 + (y - target.y) ** 2 <= target.radius ** 2) {
                    targets.splice(i, 1);
                    combo += 1;
                    msSinceHit = 0;
                    score += POINTS_PER_HIT * combo;
                    return;
                }
            }
            combo = 0;
        },

        update(deltaMs) {
            msSinceHit += deltaMs;
            if (msSinceHit > COMBO_TIMEOUT_MS) combo = 0;

            for (let i = targets.length - 1; i >= 0; i--) {
                const target = targets[i];
                target.ageMs += deltaMs;
                if (target.ageMs >= target.lifespanMs) {
                    targets.splice(i, 1);
                    combo = 0;
                }
            }

            msSinceSpawn += deltaMs;
            if (msSinceSpawn >= SPAWN_INTERVAL_MS) {
                msSinceSpawn -= SPAWN_INTERVAL_MS;
                if (targets.length < MAX_TARGETS) spawnTarget();
            }
        },
    };

    return model;

    function spawnTarget(): void {
        targets.push({
            x: MARGIN + Math.random() * (width - 2 * MARGIN),
            y: MARGIN + Math.random() * (height - 2 * MARGIN),
            radius: MIN_RADIUS + Math.random() * RADIUS_RANGE,
            ageMs: 0,
            lifespanMs: MIN_LIFESPAN_MS + Math.random() * LIFESPAN_RANGE_MS,
        });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableTarget {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    ageMs: number;
    readonly lifespanMs: number;
}

const POINTS_PER_HIT = 10;
/** How long the combo lasts with no hit. */
const COMBO_TIMEOUT_MS = 2000;
const SPAWN_INTERVAL_MS = 900;
const MAX_TARGETS = 5;
/** How far a target's centre stays from the edges of the play area. */
const MARGIN = 30;
const MIN_RADIUS = 14;
const RADIUS_RANGE = 10;
const MIN_LIFESPAN_MS = 2500;
const LIFESPAN_RANGE_MS = 1500;
