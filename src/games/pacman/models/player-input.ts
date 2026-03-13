import type { Direction } from './common';

export interface PlayerInput {
    direction: Direction;
    restartPressed: boolean;
}

export function createPlayerInput(initialDirection: Direction = 'left'): PlayerInput {
    return {
        direction: initialDirection,
        restartPressed: false,
    };
}
