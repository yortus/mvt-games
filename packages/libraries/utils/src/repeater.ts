import { createMetronome } from './metronome';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A repeater calls `onRepeat` once every `periodMs` milliseconds of game
 * time. Use it in a model, for something that happens at a steady rate, such
 * as a ship that fires while the player holds the trigger. Time passes only
 * through `update`, so it stops while the game is paused. A `periodMs` of 0
 * turns it off.
 *
 * A view that needs a steady beat should use a metronome instead, and read
 * its `count` in the refresh step.
 *
 * ```ts
 * const autoFire = createRepeater({
 *     periodMs: () => (model.isAutoFiring ? AUTO_FIRE_INTERVAL_MS : 0),
 *     onRepeat: () => model.fire(),
 * });
 *
 * // In the model's update
 * autoFire.update(deltaMs);
 * ```
 */
export interface Repeater {
    /**
     * Moves the repeater on by `deltaMs`, and calls `onRepeat` once for each
     * period that passes. The first call comes as soon as the repeater is on,
     * not a period later, and so does the first call after it's turned off
     * and on again.
     */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RepeaterOptions {
    /**
     * The time between calls to `onRepeat`, in ms. It's read on every
     * `update`, so it can change at any time. Any value of 0 or less turns
     * the repeater off, and so does a value that is not a number (NaN).
     */
    readonly periodMs: () => number;
    /** The function to call once every `periodMs`. */
    readonly onRepeat: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a repeater, which calls `onRepeat` from its `update`. */
export function createRepeater(options: RepeaterOptions): Repeater {
    const { periodMs, onRepeat } = options;
    const beat = createMetronome();
    let runs = 0;

    return {
        update(deltaMs) {
            beat.periodMs = periodMs();
            beat.update(deltaMs);
            while (runs < beat.count) {
                runs++;
                onRepeat();
            }
        },
    };
}
