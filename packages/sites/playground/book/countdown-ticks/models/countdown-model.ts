// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the countdown is still counting, or has run out. */
export type CountdownPhase = 'counting' | 'done';

/** A countdown, in whole seconds, that can be given more time while it counts. */
export interface CountdownModel {
    /** The seconds left, rounded up, so it shows 1 until the very end. */
    readonly secondsLeft: number;
    readonly phase: CountdownPhase;
    /** Adds time to a countdown that's still counting. */
    readonly addTime: (ms: number) => void;
    /** Starts the countdown again from the beginning. */
    readonly restart: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CountdownModelOptions {
    /** How long the countdown lasts, in ms. */
    readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a countdown that has just started. */
export function createCountdownModel({ durationMs }: CountdownModelOptions): CountdownModel {
    let msLeft = durationMs;
    let phase: CountdownPhase = 'counting';

    const model: CountdownModel = {
        get secondsLeft() { return Math.ceil(msLeft / 1000); },
        get phase() { return phase; },

        addTime(ms) {
            if (phase === 'counting') msLeft += ms;
        },

        restart() {
            msLeft = durationMs;
            phase = 'counting';
        },

        update(deltaMs) {
            if (phase !== 'counting') return;
            msLeft = Math.max(0, msLeft - deltaMs);
            if (msLeft === 0) phase = 'done';
        },
    };

    return model;
}
