import type { XDirection, YDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInput {
    /** Horizontal direction currently held. */
    xDirection: XDirection;
    /** Vertical direction currently held. */
    yDirection: YDirection;
    /** Whether the fire button is currently held. */
    firePressed: boolean;
    /** Whether the bomb button is currently held. */
    bombPressed: boolean;
    /** Whether the restart key is currently held. */
    restartPressed: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlayerInput(): PlayerInput {
    return {
        xDirection: 'none',
        yDirection: 'none',
        firePressed: false,
        bombPressed: false,
        restartPressed: false,
    };
}
