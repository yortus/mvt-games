// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A cycle that repeats at a steady rate, for ever. */
export interface CycleModel {
    /** How far through the cycle it is, from 0 up to 1, when the next cycle starts at 0 again. */
    readonly progress: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CycleModelOptions {
    /** How long one cycle takes, in milliseconds. */
    readonly periodMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a cycle at its start. */
export function createCycleModel({ periodMs }: CycleModelOptions): CycleModel {
    let progress = 0;

    return {
        get progress() { return progress; },

        update(deltaMs) {
            progress = (progress + deltaMs / periodMs) % 1;
        },
    };
}
