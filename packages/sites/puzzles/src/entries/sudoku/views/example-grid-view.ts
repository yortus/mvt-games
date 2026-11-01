import { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import type { GeneratedSudoku } from '../generator';
import { BoardView } from './board-view';
import { GRID_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExampleGridViewBindings {
    /** The puzzle shown, read once: its givens in ink, and the rest of its solution filled in, in blue. */
    example: GeneratedSudoku;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A puzzle, filled in, for the card that says how to play: the board, drawn small enough to fit the card's example. */
export function ExampleGridView(bindings: ExampleGridViewBindings): Container {
    const { givens, solution } = bindings.example;
    const view = new Container();
    view.scale.set(EXAMPLE_SIZE / GRID_SIZE);
    view.addChild(BoardView({
        digitAt: (cell) => solution[cell],
        isGivenAt: (cell) => givens[cell] !== 0,
        isClashAt: () => false,
        marksAt: () => 0,
        groupNotes: () => NONE,
        selection: () => NONE,
        puzzlesOpened: () => 0,
        isSolved: () => false,
        changes: () => 0,
        onSelected: () => undefined,
    }));
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NONE: readonly never[] = [];
