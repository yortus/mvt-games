// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A single boid in the flock. */
export interface BoidModel {
    /** Position in metres. */
    readonly position: { readonly x: number; readonly y: number };
    /** Scalar speed in m/s. */
    readonly speed: number;
    /** Direction of travel in radians. */
    readonly direction: number;

    /** Last-computed weighted separation acceleration x-component (m/s^2). */
    readonly separationDx: number;
    /** Last-computed weighted separation acceleration y-component (m/s^2). */
    readonly separationDy: number;
    /** Last-computed weighted alignment acceleration x-component (m/s^2). */
    readonly alignmentDx: number;
    /** Last-computed weighted alignment acceleration y-component (m/s^2). */
    readonly alignmentDy: number;
    /** Last-computed weighted cohesion acceleration x-component (m/s^2). */
    readonly cohesionDx: number;
    /** Last-computed weighted cohesion acceleration y-component (m/s^2). */
    readonly cohesionDy: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link BoidModel}. */
export interface BoidModelOptions {
    /** Initial position in metres. */
    readonly position: { readonly x: number; readonly y: number };
    /** Initial scalar speed in m/s. */
    readonly speed: number;
    /** Initial direction of travel in radians. */
    readonly direction: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a mutable boid with Cartesian velocity from initial polar options. */
export function createBoidModel(options: BoidModelOptions): MutableBoid {
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Mutable internal boid with Cartesian velocity for efficient simulation. */
export type MutableBoid = {
    /** Mutable position in metres. */
    readonly position: { x: number; y: number };
    /** Velocity x-component in m/s. */
    vx: number;
    /** Velocity y-component in m/s. */
    vy: number;
    /** Derived scalar speed in m/s. */
    readonly speed: number;
    /** Derived direction of travel in radians. */
    readonly direction: number;
    /** Current wander angle (radians). Drifts randomly each tick. */
    wanderAngle: number;
    /** Weighted separation acceleration x-component (m/s^2). */
    separationDx: number;
    /** Weighted separation acceleration y-component (m/s^2). */
    separationDy: number;
    /** Weighted alignment acceleration x-component (m/s^2). */
    alignmentDx: number;
    /** Weighted alignment acceleration y-component (m/s^2). */
    alignmentDy: number;
    /** Weighted cohesion acceleration x-component (m/s^2). */
    cohesionDx: number;
    /** Weighted cohesion acceleration y-component (m/s^2). */
    cohesionDy: number;
};
