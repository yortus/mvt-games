import { createFlockModel, type FlockModel, type FlockModelOptions } from './flock-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. It holds the flock, and the two settings that aren't the flock's own:
 * how fast its time runs, and whether each boid's influences are shown.
 */
export interface DemoModel {
    /** The flock of boids. */
    readonly flock: FlockModel;
    /** How fast the flock's time runs, as a multiple of real time. */
    timeScale: number;
    /** Whether each boid's influences are drawn over it. */
    isShowingInfluences: boolean;
    /** Moves the flock on by `deltaMs`, scaled by `timeScale`. */
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

/** Creates the demo, running in real time with the influences hidden. */
export function createDemoModel(options: DemoModelOptions): DemoModel {
    const flock = createFlockModel(options.flock);

    const model: DemoModel = {
        flock,
        timeScale: 1,
        isShowingInfluences: false,
        update(deltaMs) {
            flock.update(deltaMs * model.timeScale);
        },
    };
    return model;
}
