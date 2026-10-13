import type { Direction, HeldDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player is doing right now. The entry writes it from the host's
 * input, and the models read it each step. Keys and a joystick are held.
 * Swipes and taps on a touch screen are counted, as each is a moment that
 * can repeat, and the farmhand keeps going the way of the latest swipe until
 * the next swipe or a tap.
 */
export interface PlayerInput {
    /** The way the player is pushing, or none. It wins over a swipe. */
    direction: HeldDirection;
    /** Held to step off the fence and string wire into the meadow. A swipe strings wire without it. */
    stringPressed: boolean;
    restartPressed: boolean;
    /** The way of the latest swipe. */
    swipeDirection: Direction;
    /** Swipes so far. Each rise sets the farmhand going `swipeDirection`. */
    swipeCount: number;
    /** Taps so far. Each rise stops a farmhand set going by a swipe. */
    tapCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the player's input, with nothing held, swiped or tapped. */
export function createPlayerInput(): PlayerInput {
    return {
        direction: 'none',
        stringPressed: false,
        restartPressed: false,
        swipeDirection: 'up',
        swipeCount: 0,
        tapCount: 0,
    };
}
