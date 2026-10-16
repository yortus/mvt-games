import type { Direction } from './common';

export interface PlayerInput {
    /** Currently held direction, or 'none' if no direction key is held. */
    direction: Direction;
    pumpPressed: boolean;
    restartPressed: boolean;
}

export function createPlayerInput(initialDirection: Direction = 'none'): PlayerInput {
    const input: PlayerInput = {
        direction: initialDirection,
        pumpPressed: false,
        restartPressed: false,
    };

    return input;
}
