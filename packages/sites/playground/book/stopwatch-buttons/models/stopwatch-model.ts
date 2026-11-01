// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A stopwatch, which counts up while it runs. */
export interface StopwatchModel {
    /** How long the stopwatch has run, in ms, since it was last reset. */
    readonly elapsedMs: number;
    readonly isRunning: boolean;
    readonly start: () => void;
    readonly stop: () => void;
    /** Sets the time back to 0. Only a stopped stopwatch can be reset. */
    readonly reset: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a stopwatch at 0, stopped. */
export function createStopwatchModel(): StopwatchModel {
    let elapsedMs = 0;
    let isRunning = false;

    const model: StopwatchModel = {
        get elapsedMs() { return elapsedMs; },
        get isRunning() { return isRunning; },

        start() {
            isRunning = true;
        },

        stop() {
            isRunning = false;
        },

        reset() {
            if (!isRunning) elapsedMs = 0;
        },

        update(deltaMs) {
            if (isRunning) elapsedMs += deltaMs;
        },
    };

    return model;
}
