import type { RotationDirection } from './common';

export interface PlayerInput {
    rotationDirection: RotationDirection;
    thrustPressed: boolean;
    firePressed: boolean;
    restartPressed: boolean;
}

export function createPlayerInput(initialRotation: RotationDirection = 'none'): PlayerInput {
    const input: PlayerInput = {
        rotationDirection: initialRotation,
        thrustPressed: false,
        firePressed: false,
        restartPressed: false,
    };

    return input;
}
