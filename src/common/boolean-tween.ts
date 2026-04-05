// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Maps a boolean source value to a smoothly tweening numeric output.
 *
 * When the boolean transitions, the output tweens between `offValue` and
 * `onValue` over the configured duration. Mid-transition reversals are
 * handled gracefully - the tween reverses from its current position.
 */
export interface BooleanTween {
    /** Current tweened output value. */
    readonly value: number;
    /** Advance the tween by deltaMs. Reads the boolean source each call. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BooleanTweenOptions {
    /** Accessor that returns the current boolean source value. */
    getSource(): boolean;
    /** Output value when the source is false. */
    offValue: number;
    /** Output value when the source is true. */
    onValue: number;
    /** Duration in ms for the off-to-on transition. */
    onDurationMs: number;
    /** Duration in ms for the on-to-off transition. */
    offDurationMs: number;
    /** Easing function for the off-to-on transition. Maps 0..1 to 0..1. */
    onEasing?: (t: number) => number;
    /** Easing function for the on-to-off transition. Maps 0..1 to 0..1. */
    offEasing?: (t: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBooleanTween(options: BooleanTweenOptions): BooleanTween {
    const {
        getSource,
        offValue,
        onValue,
        onDurationMs,
        offDurationMs,
        onEasing = linear,
        offEasing = linear,
    } = options;

    // progress: 0 = fully off, 1 = fully on
    let progress = getSource() ? 1 : 0;
    let target = progress;

    const tween: BooleanTween = {
        get value() {
            const eased = target === 1
                ? onEasing(progress)
                : offEasing(1 - progress);
            return target === 1
                ? offValue + (onValue - offValue) * eased
                : onValue + (offValue - onValue) * eased;
        },

        update(deltaMs: number): void {
            target = getSource() ? 1 : 0;
            if (progress === target) return;

            if (target === 1) {
                // Transitioning toward on
                progress += onDurationMs > 0 ? deltaMs / onDurationMs : 1;
                if (progress >= 1) progress = 1;
            }
            else {
                // Transitioning toward off
                progress -= offDurationMs > 0 ? deltaMs / offDurationMs : 1;
                if (progress <= 0) progress = 0;
            }
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
