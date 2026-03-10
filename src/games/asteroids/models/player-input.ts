import type { RotationDirection } from './common';

export interface PlayerInput {
    rotation: RotationDirection;
    thrustPressed: boolean;
    firePressed: boolean;
    restartRequested: boolean;
}

export function createPlayerInput(initialRotation: RotationDirection = 'none'): PlayerInput {
    return {
        rotation: initialRotation,
        thrustPressed: false,
        firePressed: false,
        restartRequested: false,
    };
}
