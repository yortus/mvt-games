// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A metronome counts beats at a tempo you can change. Use it for anything
 * that repeats while something lasts, such as a sound (a heartbeat that
 * quickens, an alarm while fuel is low) or a blinking light. It does nothing
 * itself. Set `periodMs`, call `update(deltaMs)` in a view's update step,
 * and act each time `count` rises, for example with `watch` in the refresh
 * step.
 *
 * The first beat comes as soon as the metronome starts, not a period later.
 * The period can change at any time, so a heartbeat can quicken. The
 * metronome moves on only when `update` is called, so it stops while the
 * game is paused.
 *
 * ```ts
 * const alarm = createMetronome();
 * const watcher = watch({ beats: () => alarm.count });
 * watcher.poll();
 *
 * setUpdate(view, (deltaMs) => {
 *     alarm.periodMs = bindings.isFuelLow() ? 500 : 0;
 *     alarm.update(deltaMs);
 * });
 * setRefresh(view, () => {
 *     if (watcher.poll().beats.increased) sound.play(ALARM);
 * });
 * ```
 */
export interface Metronome {
    /** The number of beats so far. It starts at 0, and each rise is a new beat. */
    readonly count: number;
    /**
     * The time between beats, in ms. It starts at 0, which stops the
     * metronome. Any value of 0 or less stops it, and so does a value that is
     * not a number (NaN). Such a value reads back as 0. After a stop, the next
     * `update` with a positive period beats at once. Set it before calling
     * `update`.
     */
    periodMs: number;
    /**
     * Moves the metronome on by `deltaMs`. It adds a beat to `count` each
     * time a period passes. A `deltaMs` of 0 or less moves it on by nothing,
     * and so does one that is not finite. Call it from a view's update step.
     */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a new metronome. It starts stopped and has not beaten yet. It beats
 * on the first `update` after `periodMs` is set to a positive value.
 */
export function createMetronome(): Metronome {
    let count = 0;
    let periodMs = 0;
    let sinceBeatMs = 0;
    let isRunning = false;

    return {
        get count() {
            return count;
        },
        get periodMs() {
            return periodMs;
        },
        set periodMs(value) {
            periodMs = value > 0 ? value : 0;
        },

        update(deltaMs) {
            if (!(periodMs > 0)) {
                isRunning = false;
                return;
            }
            if (!isRunning) {
                isRunning = true;
                count++;
                sinceBeatMs = 0;
                return;
            }
            if (deltaMs > 0 && Number.isFinite(deltaMs)) sinceBeatMs += deltaMs;
            while (sinceBeatMs >= periodMs) {
                sinceBeatMs -= periodMs;
                count++;
            }
        },
    };
}
