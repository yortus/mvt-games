import { createFlockModel, type FlockModel, type FlockModelOptions } from '../../boids';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. All it holds is the flock, the same model as the boids demo's.
 */
export interface DemoModel {
    /** The flock of boids. */
    readonly flock: FlockModel;
    /** Moves the flock on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoModelOptions {
    /** The flock's arena, numbers and weights. */
    readonly flock: FlockModelOptions;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the demo, with the flock as it starts. */
export function createDemoModel(options: DemoModelOptions): DemoModel {
    const flock = createFlockModel(options.flock);

    return {
        flock,
        update(deltaMs) {
            flock.update(deltaMs);
        },
    };
}
