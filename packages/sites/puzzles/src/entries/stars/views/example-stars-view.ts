import type { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import { type CellMark, STAR, type StarPuzzle } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExampleStarsViewBindings {
    /** The puzzle shown, solved, read once. */
    example: StarPuzzle;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A puzzle, solved, for the card that says how to play: the board, fitted to the card's example, with every star placed. */
export function ExampleStarsView(bindings: ExampleStarsViewBindings): Container {
    const { example } = bindings;
    const markAt = (cell: number): CellMark => (example.solution[cell] === STAR ? 'star' : 'none');
    return BoardView({
        puzzle: () => example,
        width: EXAMPLE_SIZE,
        height: EXAMPLE_SIZE,
        markAt,
        isClashAt: () => false,
        isSolved: () => true,
        changes: () => 0,
        puzzlesOpened: () => 0,
    });
}
