import type { RotationDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInputModel {
    /** Currently held rotation direction, or 'none'. */
    rotation: RotationDirection;
    /** Whether the thrust key is currently held. */
    thrustPressed: boolean;
    /** Whether the fire button is currently held. */
    firePressed: boolean;
    /** Set to true when the player requests a restart. */
    restartRequested: boolean;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlayerInputModelOptions {
    readonly initialRotation?: RotationDirection;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlayerInputModel(options: PlayerInputModelOptions = {}): PlayerInputModel {
    const { initialRotation = 'none' } = options;

    const model: PlayerInputModel = {
        rotation: initialRotation,
        thrustPressed: false,
        firePressed: false,
        restartRequested: false,

        update(_deltaMs: number): void {
            // No-op — extensibility hook
        },
    };

    return model;
}
