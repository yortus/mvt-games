// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A single boid in the flock. */
export interface BoidModel {
    /** Position in metres. */
    position: { x: number; y: number };
    /** Scalar speed in m/s. */
    speed: number;
    /** Direction of travel in radians. */
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
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a mutable boid with Cartesian velocity from initial polar options. */
export function createBoidModel(options: BoidModelOptions): BoidModel {
    const { position, speed, direction } = options;
    return {
        position: { x: position.x, y: position.y },
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        get speed() { return Math.sqrt(this.vx * this.vx + this.vy * this.vy); },
        get direction() { return Math.atan2(this.vy, this.vx); },
        wanderAngle: Math.random() * Math.PI * 2,
        separationDx: 0,
        separationDy: 0,
        alignmentDx: 0,
        alignmentDy: 0,
        cohesionDx: 0,
        cohesionDy: 0,
    };
}
