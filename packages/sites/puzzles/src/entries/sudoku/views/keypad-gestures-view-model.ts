import { KEY_HOLD_MS, KEY_HOLD_QUIET_MS } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's presses on the keypad mean. A press let go soon is a tap.
 * A press held long enough, while holding can fill a cell, is a hold, and
 * letting it go then does nothing more.
 *
 * It follows one key at a time. Keys are named by their digits, so it knows
 * nothing of pixels or of Pixi, and a test can play it directly.
 */
export interface KeypadGesturesViewModel {
    /** A finger, or the mouse, went down on the key for `digit`. */
    press: (digit: number) => void;
    /** The finger or the mouse came up over the key for `digit`. */
    release: (digit: number) => void;
    /** The press ended anywhere else, so it counts for nothing. */
    cancel: () => void;
    /** Moves a press on by `deltaMs`. */
    update: (deltaMs: number) => void;
    /** How far through its hold the key for `digit` is, from 0 to 1. It shows nothing for a moment, so a tap shows no ring. */
    holdProgressFor: (digit: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KeypadGesturesViewModelOptions {
    /** Whether the keys take presses. */
    readonly isEnabled: () => boolean;
    /** Whether holding a key fills a cell. While it can't, a press stays a tap. */
    readonly canFill: () => boolean;
    /** The player tapped the key for `digit`. */
    readonly onTapped: (digit: number) => void;
    /** The player pressed the key for `digit`, and held it. */
    readonly onHeld: (digit: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gestures, with no key down. */
export function createKeypadGesturesViewModel(options: KeypadGesturesViewModelOptions): KeypadGesturesViewModel {
    const { isEnabled, canFill, onTapped, onHeld } = options;
    // The key held down, if any, for how long, and whether it has become a hold
    let heldDigit = 0;
    let heldMs = 0;
    let isHoldDone = false;

    return {
        press(digit) {
            if (!isEnabled()) return;
            heldDigit = digit;
            heldMs = 0;
            isHoldDone = false;
        },
        release(digit) {
            const isTap = heldDigit === digit && !isHoldDone;
            cancel();
            if (isTap) onTapped(digit);
        },
        cancel,
        update(deltaMs) {
            if (heldDigit === 0 || isHoldDone) return;
            heldMs += deltaMs;
            if (heldMs < KEY_HOLD_MS || !canFill()) return;
            isHoldDone = true;
            // Other views are still reading the model in this tick, so the
            // hold is reported once the frame's code has finished, which is
            // where an input event would arrive.
            const digit = heldDigit;
            queueMicrotask(() => onHeld(digit));
        },
        holdProgressFor(digit) {
            if (digit !== heldDigit) return 0;
            if (isHoldDone) return 1;
            if (!canFill()) return 0;
            return Math.max(0, Math.min(1, (heldMs - KEY_HOLD_QUIET_MS) / (KEY_HOLD_MS - KEY_HOLD_QUIET_MS)));
        },
    };

    function cancel(): void {
        heldDigit = 0;
        isHoldDone = false;
    }
}
