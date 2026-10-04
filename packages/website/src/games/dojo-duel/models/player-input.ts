import type { XDirection, YDirection } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInput {
    xDirection: XDirection;
    yDirection: YDirection;
    attackPressed: boolean;
    restartPressed: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlayerInput(): PlayerInput {
    return {
        xDirection: 'none',
        yDirection: 'none',
        attackPressed: false,
        restartPressed: false,
    };
}
