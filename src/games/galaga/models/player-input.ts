import type { Direction } from './common';

export interface PlayerInput {
    /** Currently held direction, or 'none' if no key is held. */
    direction: Direction;
    /** Whether the fire button is currently held. */
    firePressed: boolean;
    /** Whether the restart key is currently held. */
    restartPressed: boolean;
}

export function createPlayerInput(initialDirection: Direction = 'none'): PlayerInput {
    return {
        direction: initialDirection,
        firePressed: false,
        restartPressed: false,
    };
}
