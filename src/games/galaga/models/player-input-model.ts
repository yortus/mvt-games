import type { Direction } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInputModel {
    /** Currently held direction, or 'none' if no key is held. */
    direction: Direction;
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
    readonly initialDirection?: Direction;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlayerInputModel(options: PlayerInputModelOptions = {}): PlayerInputModel {
    const { initialDirection = 'none' } = options;

    const model: PlayerInputModel = {
        direction: initialDirection,
        firePressed: false,
        restartRequested: false,

        update(_deltaMs: number): void {
            // No-op — extensibility hook
        },
    };

    return model;
}
