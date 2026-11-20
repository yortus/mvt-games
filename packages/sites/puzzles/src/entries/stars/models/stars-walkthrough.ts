import type { Demo, IntroModelOptions } from '../../../shared';
import { STAR } from './cell-states';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the walkthrough's arrow touches: a point on the grid, in cells, across and down from its top left corner, or the Undo button. */
export type StarsTarget = { readonly on: 'grid'; readonly x: number; readonly y: number } | { readonly on: 'undo' };

/** The walkthrough of the controls: its steps, what their demos are found from, and how to tell targets apart. */
export type StarsWalkthrough = Pick<IntroModelOptions<PuzzleModel, StarsTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to mark a puzzle, a step at a time, on a practice puzzle. Each step
 * asks the player to do one thing, and is done once they have:
 *
 * - `cross`: put a cross in a cell, with a tap.
 * - `star`: place a star, with two taps.
 * - `group`: ring a group of cells, with a drag.
 * - `undo`: take back the last thing done.
 * - `done`: nothing more to do.
 *
 * The demos follow the practice puzzle's solution, so what the arrow marks
 * is right: a cross where there is no star, a star where there is one, and a
 * group with a star in it.
 */
export const STARS_WALKTHROUGH: StarsWalkthrough = {
    steps: [
        {
            name: 'cross',
            text: 'Tap a cell to put a cross in it: your note that it has no star. This is a practice puzzle, so try anything.',
            isDone: (puzzle) => puzzle.crossesMarked >= 1,
            findDemo: findCrossDemo,
        },
        {
            name: 'star',
            text: 'Tap a cell twice to place a star. A third tap clears it.',
            isDone: (puzzle) => puzzle.starsPlaced >= 1,
            findDemo: findStarDemo,
        },
        {
            name: 'group',
            text: 'Drag across cells to ring them: your note that a star is in one of them. Drag over the same cells again to take the ring off.',
            isDone: (puzzle) => puzzle.groupsNoted >= 1,
            findDemo: findGroupDemo,
        },
        {
            name: 'undo',
            text: 'Tap Undo to take back the last thing you did.',
            isDone: (puzzle) => puzzle.undosDone >= 1,
            findDemo: () => [{ kind: 'tap', targets: [{ on: 'undo' }] }],
        },
        {
            name: 'done',
            text: 'Place two stars in every row, every column and every region, with no two touching. Have fun!',
            isDone: () => false,
            findDemo: () => NO_DEMO,
        },
    ],
    findWhenChanged: [(puzzle) => puzzle.changes],
    isSameTarget: (a, b) => (a.on === 'undo' ? b.on === 'undo' : b.on === 'grid' && a.x === b.x && a.y === b.y),
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_DEMO: Demo<StarsTarget> = [];

/** A tap on an unmarked cell with no star, from the middle of the grid out, so the demo is in plain sight. */
function findCrossDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] !== STAR && puzzle.markAt(c) === 'none');
    return cell < 0 ? NO_DEMO : [{ kind: 'tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** Two taps on a cell with a star in the solution and none placed, or one tap if it has a cross already. */
function findStarDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] === STAR && puzzle.markAt(c) !== 'star');
    if (cell < 0) return NO_DEMO;
    return [{ kind: puzzle.markAt(cell) === 'cross' ? 'tap' : 'double-tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/**
 * A drag over two cells side by side in one region, one of them a star in
 * the solution that isn't placed yet, and the other unmarked, from the
 * middle of the grid out.
 */
function findGroupDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const { solution } = puzzle.puzzle;
    const star = findFromMiddle(puzzle, (cell) => solution[cell] === STAR && puzzle.markAt(cell) !== 'star' && findPartner(puzzle, cell) >= 0);
    if (star < 0) return NO_DEMO;
    return [{ kind: 'drag', targets: [toCellMiddle(puzzle, findPartner(puzzle, star)), toCellMiddle(puzzle, star)] }];
}

/** A cell beside `cell`, sharing a side, in the same region and unmarked, or -1 if there is none. */
function findPartner(puzzle: PuzzleModel, cell: number): number {
    const { grid, regions } = puzzle.puzzle;
    for (let side = 0; side < 4; side++) {
        const next = grid.sides[cell * 4 + side];
        if (next >= 0 && regions[next] === regions[cell] && puzzle.markAt(next) === 'none') return next;
    }
    return -1;
}

/** The cell nearest the middle of the grid that passes `test`, or -1 if none does. */
function findFromMiddle(puzzle: PuzzleModel, test: (cell: number) => boolean): number {
    const { size, cellCount } = puzzle.puzzle.grid;
    const middle = (size - 1) / 2;
    let best = -1;
    let bestDistance = Infinity;
    for (let cell = 0; cell < cellCount; cell++) {
        if (!test(cell)) continue;
        const distance = Math.abs(Math.floor(cell / size) - middle) + Math.abs((cell % size) - middle);
        if (distance < bestDistance) {
            best = cell;
            bestDistance = distance;
        }
    }
    return best;
}

function toCellMiddle(puzzle: PuzzleModel, cell: number): StarsTarget {
    const { size } = puzzle.puzzle.grid;
    return { on: 'grid', x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 };
}
