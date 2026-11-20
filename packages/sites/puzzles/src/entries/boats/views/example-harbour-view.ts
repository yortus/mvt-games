import type { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import { BOAT, type CellMark, type BoatPuzzle } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The solved harbour that the How to play card shows. */
export interface ExampleHarbourViewBindings {
    /** The puzzle shown, solved, read once. */
    example: BoatPuzzle;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A solved harbour, for the card that says how to play. It's the board,
 * fitted to the card's example, with every boat moored and its numbers
 * shown. It leaves out the fleet list.
 */
export function ExampleHarbourView(bindings: ExampleHarbourViewBindings): Container {
    const { example } = bindings;
    const markAt = (cell: number): CellMark => (example.solution[cell] === BOAT ? 'boat' : 'none');
    return BoardView({
        puzzle: () => example,
        width: EXAMPLE_SIZE,
        height: EXAMPLE_SIZE,
        hasFleet: false,
        markAt,
        isGivenAt: () => false,
        isClashAt: () => false,
        clueStateAt: () => 'met',
        finishedBoatCountOf: () => 0,
        isSolved: () => true,
        changes: () => 0,
        puzzlesOpened: () => 0,
    });
}
