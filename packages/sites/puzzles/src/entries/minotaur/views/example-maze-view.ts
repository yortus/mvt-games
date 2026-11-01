import type { Container } from 'pixi.js';
import { EXAMPLE_SIZE } from '../../../shared';
import { type EdgeMark, type MazePuzzle, PASSAGE } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExampleMazeViewBindings {
    /** The maze shown, solved, read once. */
    example: MazePuzzle;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A small maze, solved, for the card that says how to play: the board, fitted to the card's example, with its path and every wall drawn. */
export function ExampleMazeView(bindings: ExampleMazeViewBindings): Container {
    const { example } = bindings;
    const markAt = (edge: number): EdgeMark => (example.solution[edge] === PASSAGE ? 'passage' : 'unknown');
    return BoardView({
        maze: () => example,
        width: EXAMPLE_SIZE,
        height: EXAMPLE_SIZE,
        markAt,
        isClashAt: () => false,
        clueStateAt: () => 'open',
        isSolved: () => true,
        changes: () => 0,
    });
}
