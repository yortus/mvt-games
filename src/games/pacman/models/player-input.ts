import type { Direction } from './common';

export interface PlayerInput {
    direction: Direction;
    restartRequested: boolean;
}

export function createPlayerInput(initialDirection: Direction = 'left'): PlayerInput {
    return {
        direction: initialDirection,
        restartRequested: false,
    };
}
