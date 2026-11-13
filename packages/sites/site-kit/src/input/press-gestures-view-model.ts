// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's presses on a row of keys mean. A press let go soon is a
 * tap. A press held long enough, while a hold can do something, is a hold.
 * Letting it go then does nothing more.
 *
 * It follows one pointer at a time, so a second finger can't press a key
 * while the first is down. Keys are named by values of type `K`, such as
 * digits. So it knows nothing of pixels or of a renderer, and a test can
 * play it directly. The view that owns it passes it each pointer's events,
 * and moves it on in its update step.
 */
export interface PressGesturesViewModel<K> {
    /** Pointer `pointerId` went down on `key`. It is followed if no other pointer is. */
    press: (key: K, pointerId: number) => void;
    /** Pointer `pointerId` came up over `key`. */
    release: (key: K, pointerId: number) => void;
    /** Pointer `pointerId` came up anywhere else, so its press counts for nothing. */
    cancel: (pointerId: number) => void;
    /** Moves a press on by `deltaMs`, in game time. */
    update: (deltaMs: number) => void;
    /**
     * How far through its hold the press on `key` is, from 0 to 1. It shows
     * nothing for a moment (`quietMs`), so a tap shows no progress.
     */
    holdProgressFor: (key: K) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PressGesturesViewModelOptions<K> {
    /** How long a press must be held to be a hold. */
    readonly holdMs: number;
    /** How long a press shows no progress, so that a tap shows none. */
    readonly quietMs: number;
    /** Whether the keys take presses. */
    readonly isEnabled: () => boolean;
    /** Whether a hold can do something now. While it can't, a press stays a tap. */
    readonly canHold: () => boolean;
    /** The player tapped `key`. */
    readonly onTapped: (key: K) => void;
    /** The player pressed `key`, and held it. */
    readonly onHeld: (key: K) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the gestures, with no key down.
 *
 * A tap is reported from the pointer's own event, as it comes up. A hold is
 * noticed in the update step, during a frame. So it is reported from a
 * microtask, once the frame's code has finished, which is where an input
 * event would arrive.
 */
export function createPressGesturesViewModel<K>(options: PressGesturesViewModelOptions<K>): PressGesturesViewModel<K> {
    const { holdMs, quietMs, isEnabled, canHold, onTapped, onHeld } = options;
    // The key pressed, if any, by which pointer, for how long, and whether it has become a hold
    let pressedKey: K | undefined;
    let pointer = 0;
    let heldMs = 0;
    let isHoldDone = false;

    return {
        press(key, pointerId) {
            if (pressedKey !== undefined || !isEnabled()) return;
            pressedKey = key;
            pointer = pointerId;
            heldMs = 0;
            isHoldDone = false;
        },
        release(key, pointerId) {
            if (pressedKey === undefined || pointerId !== pointer) return;
            const isTap = pressedKey === key && !isHoldDone;
            pressedKey = undefined;
            if (isTap) onTapped(key);
        },
        cancel(pointerId) {
            if (pointerId === pointer) pressedKey = undefined;
        },
        update(deltaMs) {
            if (pressedKey === undefined || isHoldDone) return;
            heldMs += deltaMs;
            if (heldMs < holdMs || !canHold()) return;
            isHoldDone = true;
            const key = pressedKey;
            queueMicrotask(() => onHeld(key));
        },
        holdProgressFor(key) {
            if (pressedKey === undefined || key !== pressedKey) return 0;
            if (isHoldDone) return 1;
            if (!canHold()) return 0;
            return Math.max(0, Math.min(1, (heldMs - quietMs) / (holdMs - quietMs)));
        },
    };
}
