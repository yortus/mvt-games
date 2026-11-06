import { createTrackerModel, type TrackerModel } from './tracker-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. All it holds is the tracker, where the demo's state and rules live.
 */
export interface DemoModel {
    /** The tracker, with the tune chosen and whether it's playing. */
    readonly tracker: TrackerModel;
    /** Moves the tracker on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoModelOptions {
    /** How many tunes there are, 1 or more. */
    readonly tuneCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the demo, with the tracker stopped on the first tune. */
export function createDemoModel(options: DemoModelOptions): DemoModel {
    const tracker = createTrackerModel(options);

    return {
        tracker,
        update(deltaMs) {
            tracker.update(deltaMs);
        },
    };
}
