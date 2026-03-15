import type { Direction } from './common';

export interface PlayerInput {
    direction: Direction;
    restartPressed: boolean;
}

export function createPlayerInput(initialDirection: Direction = 'left'): PlayerInput {
    const input: PlayerInput = {
        direction: initialDirection,
        restartPressed: false,
    };

    return input;
}
