import type { GroundPoint } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A closed track, measured at evenly spaced points along its centre line.
 * It never changes, so it doesn't need an update. The car and the views both read it.
 */
export interface Track {
    /** The points along the centre line, in order round the loop. The first is on the start line. */
    readonly samples: readonly TrackSample[];
    /** How far it is round the loop, in metres. */
    readonly length: number;
    /** The asphalt's width, in metres. */
    readonly width: number;
    /** The sample nearest to a point, searching outwards from a sample near it, such as the last one found. */
    readonly findNearestSample: (x: number, z: number, near: number) => number;
    /** The sample nearest to a point, searching the whole track. */
    readonly findNearestSampleAnywhere: (x: number, z: number) => number;
    /** How far a point is from the centre line at a sample, positive to the left of the way the track runs. */
    readonly measureOffset: (x: number, z: number, sample: number) => number;
    /**
     * How far the wall stands from the centre line at a sample, on the left
     * (`side` 1) or the right (-1), in metres. It's the full distance the
     * track was made with, except on the inside of a bend too tight for it.
     * There the wall comes closer, so it never crosses back over itself.
     */
    readonly findWallOffset: (sample: number, side: 1 | -1) => number;
    /**
     * Finds the point `distance` along the track and `offset` to the left of
     * its centre line, and the way the track runs there, and writes them to
     * `out`. It writes rather than returns, so a caller every step allocates
     * nothing. The distance wraps round the loop.
     */
    readonly locate: (distance: number, offset: number, out: TrackPlace) => void;
}

/** A place on the track, as `locate` writes it. */
export interface TrackPlace {
    x: number;
    z: number;
    /** The way the track runs there, as an angle from +x toward +z, in radians. */
    heading: number;
}

/** A point on the centre line, and the way the track runs there. */
export interface TrackSample {
    readonly x: number;
    readonly z: number;
    /** The direction the track runs, as a unit vector on the ground. */
    readonly directionX: number;
    readonly directionZ: number;
    /** How far it is from the start line, along the centre line. */
    readonly distance: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TrackOptions {
    /** Points the centre line passes through, in order round the loop. */
    readonly points: readonly GroundPoint[];
    /** The asphalt's width, in metres. */
    readonly width: number;
    /** How far the walls stand from the centre line, in metres, wherever the track is straight enough for it. */
    readonly wallOffset: number;
    /** The spacing of the samples, in metres. The last gap, back to the start, is a little shorter or longer. */
    readonly sampleSpacing: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a track from the points its centre line passes through. The line
 * is a centripetal Catmull-Rom curve, which passes through every point
 * without overshooting where they bunch up or spread out.
 */
export function createTrack(options: TrackOptions): Track {
    const { points, width, wallOffset, sampleSpacing } = options;
    const dense = traceCurve(points);
    const samples = spaceEvenly(dense, sampleSpacing);
    const length = measureLoop(dense);
    const leftWalls = fitWalls({ samples, length, wallOffset, halfWidth: width / 2, side: 1 });
    const rightWalls = fitWalls({ samples, length, wallOffset, halfWidth: width / 2, side: -1 });

    return {
        samples,
        length,
        width,
        findNearestSample(x, z, near) {
            // The car moves far less than a sample in one step, so a short
            // search either side of the last sample always finds the nearest
            let best = near;
            let bestDistance = Infinity;
            const count = samples.length;
            for (let offset = -SEARCH_REACH; offset <= SEARCH_REACH; offset++) {
                const index = (near + offset + count) % count;
                const distance = squaredDistance(samples[index], x, z);
                if (distance < bestDistance) {
                    best = index;
                    bestDistance = distance;
                }
            }
            return best;
        },
        findWallOffset(sample, side) {
            return side > 0 ? leftWalls[sample] : rightWalls[sample];
        },
        measureOffset(x, z, sample) {
            const { x: sx, z: sz, directionX, directionZ } = samples[sample];
            // The track's left, with +z toward the viewer, is (dz, -dx)
            return (x - sx) * directionZ - (z - sz) * directionX;
        },
        locate(distance, offset, out) {
            const along = ((distance % length) + length) % length;
            const count = samples.length;
            const index = Math.min(count - 1, Math.floor(along / sampleSpacing));
            const a = samples[index];
            const b = samples[(index + 1) % count];
            const span = (index + 1 < count ? b.distance : length) - a.distance;
            const t = Math.min(1, (along - a.distance) / span);
            const dx = a.directionX + (b.directionX - a.directionX) * t;
            const dz = a.directionZ + (b.directionZ - a.directionZ) * t;
            const size = Math.hypot(dx, dz);
            out.x = a.x + (b.x - a.x) * t + (dz / size) * offset;
            out.z = a.z + (b.z - a.z) * t - (dx / size) * offset;
            out.heading = Math.atan2(dz, dx);
        },
        findNearestSampleAnywhere(x, z) {
            let best = 0;
            let bestDistance = Infinity;
            for (let i = 0; i < samples.length; i++) {
                const distance = squaredDistance(samples[i], x, z);
                if (distance < bestDistance) {
                    best = i;
                    bestDistance = distance;
                }
            }
            return best;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many samples either side of the last one the nearest-sample search looks. */
const SEARCH_REACH = 12;

/** How many points each stretch of the curve is traced with, before the samples are spaced evenly. */
const POINTS_PER_SPAN = 64;

/** How many samples either side a bend's radius is measured across: one, so the sharpest point of a bend isn't averaged away. */
const BEND_REACH = 1;
/** How far inside a bend's radius its inside wall stands, at least, in metres, so the wall's stretches never fold back. */
const BEND_MARGIN = 5;
/** How far from the asphalt's edge the wall stands, at least, in metres, however tight the bend. */
const MIN_RUNOFF = 3;
/** How many samples either side a narrowing reaches, so the wall comes in before a tight bend and goes out after it. */
const EASE_REACH = 6;

/**
 * Works out how far the wall on one side stands from the centre line at
 * each sample. Where that side is the inside of a bend tighter than the
 * full distance, the wall stands a margin inside the bend's radius. Each
 * narrowing then reaches a few samples either way, and the result is
 * smoothed, so the wall comes in and goes out gently.
 */
function fitWalls(options: { samples: readonly TrackSample[]; length: number; wallOffset: number; halfWidth: number; side: 1 | -1 }): number[] {
    const { samples, length, wallOffset, halfWidth, side } = options;
    const count = samples.length;
    const tightest: number[] = [];
    for (let i = 0; i < count; i++) {
        const before = samples[(i - BEND_REACH + count) % count];
        const after = samples[(i + BEND_REACH) % count];
        // The direction turns toward the inside of the bend. The track's left is (dz, -dx)
        const turnX = after.directionX - before.directionX;
        const turnZ = after.directionZ - before.directionZ;
        const towardLeft = turnX * samples[i].directionZ - turnZ * samples[i].directionX;
        const angle = Math.acos(Math.max(-1, Math.min(1, before.directionX * after.directionX + before.directionZ * after.directionZ)));
        const isInside = towardLeft * side > 0;
        // The bend's radius is the distance along it over the angle it turns
        const along = (after.distance - before.distance + length) % length;
        const radius = angle > 0 ? along / angle : Infinity;
        tightest.push(isInside ? Math.max(halfWidth + MIN_RUNOFF, Math.min(wallOffset, radius - BEND_MARGIN)) : wallOffset);
    }
    // Each narrowing reaches a few samples either way, then the edges are smoothed
    const reached: number[] = [];
    for (let i = 0; i < count; i++) {
        let least = wallOffset;
        for (let k = -EASE_REACH; k <= EASE_REACH; k++) least = Math.min(least, tightest[(i + k + count) % count]);
        reached.push(least);
    }
    const walls: number[] = [];
    for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let k = -EASE_REACH; k <= EASE_REACH; k++) sum += reached[(i + k + count) % count];
        walls.push(sum / (EASE_REACH * 2 + 1));
    }
    return walls;
}

function squaredDistance(sample: TrackSample, x: number, z: number): number {
    const dx = sample.x - x;
    const dz = sample.z - z;
    return dx * dx + dz * dz;
}

/** Traces the closed curve through the points as many short straight steps, ending where it started. */
function traceCurve(points: readonly GroundPoint[]): GroundPoint[] {
    const traced: GroundPoint[] = [];
    const count = points.length;
    for (let i = 0; i < count; i++) {
        const p0 = points[(i - 1 + count) % count];
        const p1 = points[i];
        const p2 = points[(i + 1) % count];
        const p3 = points[(i + 2) % count];
        for (let step = 0; step < POINTS_PER_SPAN; step++) {
            traced.push(pointOnSpan(p0, p1, p2, p3, step / POINTS_PER_SPAN));
        }
    }
    traced.push(traced[0]);
    return traced;
}

/**
 * A point on the centripetal Catmull-Rom span from p1 to p2, at `t` from 0
 * to 1. Its knots are spaced by the square root of the distance between
 * points, which is what keeps it from looping or overshooting.
 */
function pointOnSpan(p0: GroundPoint, p1: GroundPoint, p2: GroundPoint, p3: GroundPoint, t: number): GroundPoint {
    const t0 = 0;
    const t1 = t0 + Math.sqrt(Math.hypot(p1.x - p0.x, p1.z - p0.z));
    const t2 = t1 + Math.sqrt(Math.hypot(p2.x - p1.x, p2.z - p1.z));
    const t3 = t2 + Math.sqrt(Math.hypot(p3.x - p2.x, p3.z - p2.z));
    const u = t1 + (t2 - t1) * t;
    const a1 = blend(p0, p1, t0, t1, u);
    const a2 = blend(p1, p2, t1, t2, u);
    const a3 = blend(p2, p3, t2, t3, u);
    const b1 = blend(a1, a2, t0, t2, u);
    const b2 = blend(a2, a3, t1, t3, u);
    return blend(b1, b2, t1, t2, u);
}

/** The point between a and b at `u`, where a sits at `ta` and b at `tb`. */
function blend(a: GroundPoint, b: GroundPoint, ta: number, tb: number, u: number): GroundPoint {
    const wa = (tb - u) / (tb - ta);
    const wb = (u - ta) / (tb - ta);
    return { x: a.x * wa + b.x * wb, z: a.z * wa + b.z * wb };
}

function measureLoop(traced: readonly GroundPoint[]): number {
    let length = 0;
    for (let i = 1; i < traced.length; i++) {
        length += Math.hypot(traced[i].x - traced[i - 1].x, traced[i].z - traced[i - 1].z);
    }
    return length;
}

/** Walks along the traced curve, dropping a sample every `spacing` metres. */
function spaceEvenly(traced: readonly GroundPoint[], spacing: number): TrackSample[] {
    const positions: GroundPoint[] = [traced[0]];
    const distances: number[] = [0];
    let travelled = 0;
    let nextAt = spacing;
    for (let i = 1; i < traced.length; i++) {
        const from = traced[i - 1];
        const to = traced[i];
        const stepLength = Math.hypot(to.x - from.x, to.z - from.z);
        while (travelled + stepLength >= nextAt) {
            const t = (nextAt - travelled) / stepLength;
            positions.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
            distances.push(nextAt);
            nextAt += spacing;
        }
        travelled += stepLength;
    }
    // The last sample can land on the start, or within a sliver of it, which would double it up
    const last = positions[positions.length - 1];
    if (Math.hypot(last.x - traced[0].x, last.z - traced[0].z) < spacing / 2) {
        positions.pop();
        distances.pop();
    }

    const count = positions.length;
    const samples: TrackSample[] = [];
    for (let i = 0; i < count; i++) {
        // The direction is the chord from the sample before to the one after
        const before = positions[(i - 1 + count) % count];
        const after = positions[(i + 1) % count];
        const dx = after.x - before.x;
        const dz = after.z - before.z;
        const chord = Math.hypot(dx, dz);
        samples.push({
            x: positions[i].x,
            z: positions[i].z,
            directionX: dx / chord,
            directionZ: dz / chord,
            distance: distances[i],
        });
    }
    return samples;
}
