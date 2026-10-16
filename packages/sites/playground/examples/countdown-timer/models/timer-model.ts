// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the timer is still counting down, or has run out. */
export type TimerPhase = 'running' | 'done';

/**
 * A timer that counts down to 0, then stops. Time reaches it only through
 * `update(deltaMs)`, so pausing the playground pauses the timer too.
 */
export interface TimerModel {
    /** The time left, in ms. */
    readonly remainingMs: number;
    /** The time the timer started with, in ms. */
    readonly durationMs: number;
    /** How much of the time has passed, from 0 at the start to 1 when it runs out. */
    readonly progress: number;
    readonly phase: TimerPhase;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TimerModelOptions {
    /** The time to count down from, in ms. */
    readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a timer that starts running with all its time left. */
export function createTimerModel({ durationMs }: TimerModelOptions): TimerModel {
    let remainingMs = durationMs;
    let phase: TimerPhase = 'running';

    const model: TimerModel = {
        get remainingMs() { return remainingMs; },
        durationMs,
        get progress() { return 1 - remainingMs / durationMs; },
        get phase() { return phase; },

        update(deltaMs) {
            if (phase === 'done') return;
            remainingMs -= deltaMs;
            if (remainingMs <= 0) {
                remainingMs = 0;
                phase = 'done';
            }
        },
    };

    return model;
}
