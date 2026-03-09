import type { Direction } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlayerInputModel {
    direction: Direction;
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
    const { initialDirection = 'left' } = options;

    const model: PlayerInputModel = {
        direction: initialDirection,
        restartRequested: false,

        update(_deltaMs: number): void {
            // No-op — extensibility hook for future input buffering,
            // repeat delays, analog processing, etc.
        },
    };

    return model;
}
