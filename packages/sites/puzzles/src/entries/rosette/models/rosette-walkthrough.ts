import type { Demo, IntroModelOptions } from '../../../shared';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the walkthrough's arrow touches: the middle of a tile of the picture, or the Undo button. */
export type RosetteTarget = { readonly on: 'tile'; readonly tile: number } | { readonly on: 'undo' };

/** The walkthrough of swapping pieces: its steps, what their demos are found from, and how to tell targets apart. */
export type RosetteWalkthrough = Pick<IntroModelOptions<PuzzleModel, RosetteTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to put a picture back together, a step at a time, on a practice
 * picture. Each step asks the player to do one thing, and is done once they
 * have:
 *
 * - `drag`: swap two pieces, with a drag.
 * - `tap`: swap two more, with two taps.
 * - `undo`: take back the last swap.
 * - `done`: nothing more to do.
 *
 * The demos follow the solution, so what the arrow does is right: it takes
 * a piece to its own tile.
 */
export const ROSETTE_WALKTHROUGH: RosetteWalkthrough = {
    steps: [
        {
            name: 'drag',
            text: 'Drag a piece onto another of its shape, and the two swap. This is a practice window, so try anything.',
            isDone: (puzzle) => puzzle.swapsMade >= 1,
            findDemo: (puzzle) => findHomeMove(puzzle, 'drag'),
        },
        {
            name: 'tap',
            text: 'Or tap a piece, then tap another of its shape, to swap them.',
            isDone: (puzzle) => puzzle.swapsMade >= 2,
            findDemo: (puzzle) => findHomeMove(puzzle, 'tap'),
        },
        {
            name: 'undo',
            text: 'Tap Undo to take back the last swap.',
            isDone: (puzzle) => puzzle.undosDone >= 1,
            findDemo: () => [{ kind: 'tap', targets: [{ on: 'undo' }] }],
        },
        {
            name: 'done',
            text: 'Put every piece back so the colours run smoothly. Work in from the locked pieces round the frame. Have fun!',
            isDone: () => false,
            findDemo: () => NO_DEMO,
        },
    ],
    findWhenChanged: [(puzzle) => puzzle.changes],
    isSameTarget: (a, b) => (a.on === 'undo' ? b.on === 'undo' : b.on === 'tile' && a.tile === b.tile),
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_DEMO: Demo<RosetteTarget> = [];

/** Takes the piece on the tile nearest the middle that holds a stranger to its own tile, with a drag or two taps. */
function findHomeMove(puzzle: PuzzleModel, kind: 'drag' | 'tap'): Demo<RosetteTarget> {
    const count = puzzle.puzzle.patch.count;
    for (let tile = 0; tile < count; tile++) {
        const piece = puzzle.pieceAt(tile);
        if (piece === tile) continue;
        const from: RosetteTarget = { on: 'tile', tile };
        const to: RosetteTarget = { on: 'tile', tile: piece };
        if (kind === 'drag') return [{ kind: 'drag', targets: [from, to] }];
        return [{ kind: 'tap', targets: [from] }, { kind: 'tap', targets: [to] }];
    }
    return NO_DEMO;
}
