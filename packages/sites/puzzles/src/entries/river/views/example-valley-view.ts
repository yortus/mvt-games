import type { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import { RIVER, type RiverPuzzle } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExampleValleyViewBindings {
    /** The puzzle shown, solved, read once. */
    example: RiverPuzzle;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A valley, solved, for the card that says how to play: the board, fitted to the card's example, with the whole river drawn and the meadow in bloom. */
export function ExampleValleyView(bindings: ExampleValleyViewBindings): Container {
    const { example } = bindings;
    return BoardView({
        puzzle: () => example,
        width: EXAMPLE_SIZE,
        height: EXAMPLE_SIZE,
        isRiverAt: (edge) => example.solutionEdges[edge] === RIVER,
        isMeadowAt: () => false,
        isGivenAt: () => false,
        isClashAt: () => false,
        clueStateAt: () => 'met',
        isSolved: () => true,
        changes: () => 0,
        puzzlesOpened: () => 0,
    });
}
