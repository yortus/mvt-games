import type { XDirection, YDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player is holding right now. The entry writes it from the input
 * views' relay bindings; the models read it once per step. There is no fire
 * button: the ship fires on its own.
 */
export interface PlayerInput {
    xDirection: XDirection;
    yDirection: YDirection;
    /** Held to fly slowly, show the hitbox, and fire the narrow column. */
    focusPressed: boolean;
    bombPressed: boolean;
    restartPressed: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlayerInput(): PlayerInput {
    return {
        xDirection: 'none',
        yDirection: 'none',
        focusPressed: false,
        bombPressed: false,
        restartPressed: false,
    };
}
