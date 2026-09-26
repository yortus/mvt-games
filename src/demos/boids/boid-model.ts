// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A single boid in the flock. A plain record of numbers, written in place by
 * the flock model each step. It has no getters on purpose: when `speed` and
 * `direction` were getters on this literal, the flock's per-step writes to
 * the other fields allocated about 34 KB per frame for 200 boids, likely
 * because V8 kept the record in a slower form that boxes each fractional
 * number.
 */
export interface BoidModel {
    /** Position in metres. */
    position: { x: number; y: number };
    /** Scalar speed in m/s, as of the last step. */
    speed: number;
    /** Direction of travel in radians, as of the last step. */
    direction: number;

    /** Velocity x-component in m/s. */
    vx: number;
    /** Velocity y-component in m/s. */
    vy: number;
    /** Current wander angle (radians). Drifts randomly each tick. */
    wanderAngle: number;

    /** Last-computed weighted separation acceleration x-component (m/s^2). */
    separationDx: number;
    /** Last-computed weighted separation acceleration y-component (m/s^2). */
    separationDy: number;
    /** Last-computed weighted alignment acceleration x-component (m/s^2). */
    alignmentDx: number;
    /** Last-computed weighted alignment acceleration y-component (m/s^2). */
    alignmentDy: number;
    /** Last-computed weighted cohesion acceleration x-component (m/s^2). */
    cohesionDx: number;
    /** Last-computed weighted cohesion acceleration y-component (m/s^2). */
    cohesionDy: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link BoidModel}. */
export interface BoidModelOptions {
    /** Initial position in metres. */
    position: { x: number; y: number };
    /** Initial scalar speed in m/s. */
    speed: number;
    /** Initial direction of travel in radians. */
    direction: number;
    /** Initial wander angle in radians. */
    wanderAngle: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a mutable boid with Cartesian velocity from initial polar options. */
export function createBoidModel(options: BoidModelOptions): BoidModel {
    const { position, speed, direction, wanderAngle } = options;
    return {
        position: { x: position.x, y: position.y },
        speed,
        direction,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        wanderAngle,
        separationDx: 0,
        separationDy: 0,
        alignmentDx: 0,
        alignmentDy: 0,
        cohesionDx: 0,
        cohesionDy: 0,
    };
}
