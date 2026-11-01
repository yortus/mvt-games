import type { Random } from './seeded-random';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a spark burns, in ms. */
const LIFE_MS = 1600;

/** How fast a falling spark speeds up, in world units per ms, per ms. */
const GRAVITY = 0.0004;

/** How far either side of straight up a spark can be thrown, in radians, in all. */
const SPREAD = 1.1;

/** The slowest a spark is thrown, in world units per ms. */
const MIN_SPEED = 0.18;
/** The fastest a spark is thrown, in world units per ms. */
const MAX_SPEED = 0.42;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A fountain of sparks. It throws sparks upwards at a steady rate, gravity
 * pulls them down, and each burns out after a while. Positions are in world
 * units, with the play area's top left corner at 0, 0.
 *
 * The sparks are kept in arrays made once, and a spark that burns out
 * makes room for a new one, so the model makes nothing new as it runs.
 */
export interface FountainModel {
    /** How many sparks are alight. Sparks 0 to `count - 1` are the live ones. */
    readonly count: number;
    readonly xAt: (index: number) => number;
    readonly yAt: (index: number) => number;
    /** How much of its life a spark has burned, from 0 when it's thrown to 1 when it burns out. */
    readonly burnedAt: (index: number) => number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FountainModelOptions {
    /** Where the sparks are thrown from, in world units. */
    readonly x: number;
    readonly y: number;
    /** How many sparks are thrown each second. */
    readonly sparksPerSecond: number;
    /** Which way each spark is thrown, and how hard, come from this. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a fountain with no sparks yet. */
export function createFountainModel({ x, y, sparksPerSecond, random }: FountainModelOptions): FountainModel {
    const capacity = Math.ceil(sparksPerSecond * LIFE_MS / 1000) + 1;
    const xs = new Float64Array(capacity);
    const ys = new Float64Array(capacity);
    const vxs = new Float64Array(capacity);
    const vys = new Float64Array(capacity);
    const ages = new Float64Array(capacity);
    let count = 0;
    // Sparks due to be thrown, but not yet thrown: a fraction of one, between ticks
    let owed = 0;

    const model: FountainModel = {
        get count() { return count; },
        xAt: (index) => xs[index],
        yAt: (index) => ys[index],
        burnedAt: (index) => ages[index] / LIFE_MS,

        update(deltaMs) {
            // Moves every spark on, and lets the burned out ones go. The last
            // spark takes a burned out one's place, so the live ones stay together.
            for (let i = count - 1; i >= 0; i--) {
                ages[i] += deltaMs;
                if (ages[i] >= LIFE_MS) {
                    count--;
                    copySpark(count, i);
                    continue;
                }
                vys[i] += GRAVITY * deltaMs;
                xs[i] += vxs[i] * deltaMs;
                ys[i] += vys[i] * deltaMs;
            }

            owed += sparksPerSecond * deltaMs / 1000;
            while (owed >= 1 && count < capacity) {
                owed--;
                throwSpark();
            }
        },
    };

    return model;

    function throwSpark(): void {
        const angle = -Math.PI / 2 + (random() - 0.5) * SPREAD;
        const speed = MIN_SPEED + random() * (MAX_SPEED - MIN_SPEED);
        xs[count] = x;
        ys[count] = y;
        vxs[count] = Math.cos(angle) * speed;
        vys[count] = Math.sin(angle) * speed;
        ages[count] = 0;
        count++;
    }

    function copySpark(from: number, to: number): void {
        xs[to] = xs[from];
        ys[to] = ys[from];
        vxs[to] = vxs[from];
        vys[to] = vys[from];
        ages[to] = ages[from];
    }
}
