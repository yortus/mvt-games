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

    // Debug: last-computed weighted acceleration contributions (m/s^2)
    readonly separationDx: number;
    readonly separationDy: number;
    readonly alignmentDx: number;
    readonly alignmentDy: number;
    readonly cohesionDx: number;
    readonly cohesionDy: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoidModelOptions {
    readonly position: { readonly x: number; readonly y: number };
    readonly speed: number;
    readonly direction: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

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
    readonly position: { x: number; y: number };
    vx: number;
    vy: number;
    readonly speed: number;
    readonly direction: number;
    /** Current wander angle (radians). Drifts randomly each tick. */
    wanderAngle: number;
    separationDx: number;
    separationDy: number;
    alignmentDx: number;
    alignmentDy: number;
    cohesionDx: number;
    cohesionDy: number;
};
