import type { RotationDirection } from './common';

export interface PlayerInput {
    rotation: RotationDirection;
    thrustPressed: boolean;
    firePressed: boolean;
    restartPressed: boolean;
}

export function createPlayerInput(initialRotation: RotationDirection = 'none'): PlayerInput {
    return {
        rotation: initialRotation,
        thrustPressed: false,
        firePressed: false,
        restartPressed: false,
    };
}
