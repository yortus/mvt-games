// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Tells a double tap from two taps: a second tap on the same thing, a cell
 * or a key, soon after the first. It is presentation state for a view that
 * takes taps, which keeps it, and moves its clock on in its update step.
 */
export interface DoubleTapTracker {
    /** Whether a tap on `target` now would be the second of a double tap: the last tap noted was on it, and was recent. */
    isSecondTap: (target: number) => boolean;
    /** Notes a tap on `target` now, which a second tap could follow. */
    noteTap: (target: number) => void;
    /** Forgets the last tap, so that no tap makes a double tap with it, as once a double tap is done. */
    forget: () => void;
    /** Moves the clock on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a tracker that has seen no tap yet. */
export function createDoubleTapTracker(): DoubleTapTracker {
    let clockMs = 0;
    let lastTarget = NONE;
    let lastMs = 0;
    return {
        isSecondTap: (target) => target === lastTarget && clockMs - lastMs <= DOUBLE_TAP_MS,
        noteTap(target) {
            lastTarget = target;
            lastMs = clockMs;
        },
        forget() { lastTarget = NONE; },
        update(deltaMs) { clockMs += deltaMs; },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A second tap this soon after the first, in ms, makes a double tap. */
const DOUBLE_TAP_MS = 350;

/** No target: no tap to follow. */
const NONE = -1;
