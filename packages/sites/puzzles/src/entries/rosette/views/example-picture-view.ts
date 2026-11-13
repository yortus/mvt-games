import type { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import type { GlassWindow } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExamplePictureViewBindings {
    /** The picture shown, whole, read once. */
    example: GlassWindow;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A small picture, whole, for the card that says how to play: the board,
 * fitted to the card's example, with every piece home, but shown as a
 * picture still in play, so its locked pieces have their heavier lead and
 * the rest their rings, as the card says.
 */
export function ExamplePictureView(bindings: ExamplePictureViewBindings): Container {
    const { example } = bindings;
    return BoardView({
        puzzle: () => example,
        width: EXAMPLE_SIZE,
        height: EXAMPLE_SIZE,
        pieceAt: (tile) => tile,
        isLockedAt: (tile) => example.locked[tile] === 1,
        isSolved: () => false,
        changes: () => 0,
        puzzlesOpened: () => 0,
    });
}
