// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A stopwatch, which counts time while it runs. */
export interface StopwatchModel {
    /** The time counted, in milliseconds. */
    readonly elapsedMs: number;
    readonly isRunning: boolean;
    /** Starts a stopped stopwatch, or stops a running one. */
    readonly startOrStop: () => void;
    /** Sets the time counted back to 0, leaving it running or stopped. */
    readonly reset: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a stopwatch, stopped, at 0. */
export function createStopwatchModel(): StopwatchModel {
    let elapsedMs = 0;
    let isRunning = false;

    return {
        get elapsedMs() { return elapsedMs; },
        get isRunning() { return isRunning; },

        startOrStop() {
            isRunning = !isRunning;
        },

        reset() {
            elapsedMs = 0;
        },

        update(deltaMs) {
            if (isRunning) elapsedMs += deltaMs;
        },
    };
}
