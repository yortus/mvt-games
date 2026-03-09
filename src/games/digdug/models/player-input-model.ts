import type { Direction } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInputModel {
    /** Currently held direction, or 'none' if no direction key is held. */
    direction: Direction;
    pumpPressed: boolean;
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
        pumpPressed: false,
        restartRequested: false,

        update(_deltaMs: number): void {
            // No-op — extensibility hook for future input buffering
        },
    };

    return model;
}
