// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Watches a boolean source for a rising edge (false to true) and plays a
 * one-shot tween from `triggerValue` to `restValue`. The value rests at `restValue`
 * when idle. Re-triggering during an active tween restarts from `triggerValue`.
 */
export interface EdgeTween {
    /** Current tweened output value. */
    readonly value: number;
    /** Advance the tween by deltaMs. Reads the boolean source each call. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EdgeTweenOptions {
    /** Accessor that returns the current boolean source value. */
    getSource(): boolean;
    /** Output value at the moment of trigger. */
    triggerValue: number;
    /** Resting output value (also the end of each tween). */
    restValue: number;
    /** Duration in ms for the triggered tween. */
    durationMs: number;
    /** Easing function for the tween. Maps 0..1 to 0..1. */
    easing?: (t: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEdgeTween(options: EdgeTweenOptions): EdgeTween {
    const {
        getSource,
        triggerValue,
        restValue,
        durationMs,
        easing = linear,
    } = options;

    // progress: 0 = just triggered (triggerValue), 1 = completed (restValue)
    let progress = 1;
    let wasTrue = false;

    const tween: EdgeTween = {
        get value() {
            if (progress >= 1) return restValue;
            const eased = easing(progress);
            return triggerValue + (restValue - triggerValue) * eased;
        },

        update(deltaMs: number): void {
            const source = getSource();
            if (source && !wasTrue) progress = 0;
            wasTrue = source;

            if (progress >= 1) return;
            progress += durationMs > 0 ? deltaMs / durationMs : 1;
            if (progress > 1) progress = 1;
        },
    };

    return tween;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function linear(t: number): number {
    return t;
}
