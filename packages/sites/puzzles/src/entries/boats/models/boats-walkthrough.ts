import type { Demo, IntroModelOptions } from '../../../shared';
import { BOAT } from './cell-states';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the walkthrough's arrow touches: a point on the harbour, in cells, across and down from its top left corner, or the Undo button. */
export type BoatsTarget = { readonly on: 'grid'; readonly x: number; readonly y: number } | { readonly on: 'undo' };

/** The walkthrough of the controls: its steps, what their demos are found from, and how to tell targets apart. */
export type BoatsWalkthrough = Pick<IntroModelOptions<PuzzleModel, BoatsTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to mark a harbour, a step at a time, on a practice puzzle. Each step
 * asks the player to do one thing, and is done once they have:
 *
 * - `water`: mark a cell as water, with a tap.
 * - `boat`: mark part of a boat, with two taps.
 * - `sweep`: mark a few cells at once, with a drag.
 * - `undo`: take back the last thing done.
 * - `done`: nothing more to do.
 *
 * The demos follow the practice puzzle's solution, so what the arrow marks
 * is right: water where there is water, and a boat where there is one.
 */
export const BOATS_WALKTHROUGH: BoatsWalkthrough = {
    steps: [
        {
            name: 'water',
            text: 'Tap a cell to mark it as water: your note that a boat isn\'t there. This is a practice puzzle, so try anything.',
            isDone: (puzzle) => puzzle.waterMarked >= 1,
            findDemo: findWaterDemo,
        },
        {
            name: 'boat',
            text: 'Tap a cell twice to mark part of a boat. A third tap clears it.',
            isDone: (puzzle) => puzzle.boatsMarked >= 1,
            findDemo: findBoatDemo,
        },
        {
            name: 'sweep',
            text: 'Drag across cells to mark them all the way a tap marks the first. Drag from an empty cell to mark water.',
            isDone: (puzzle) => puzzle.sweepsMade >= 1,
            findDemo: findSweepDemo,
        },
        {
            name: 'undo',
            text: 'Tap Undo to take back the last thing you did.',
            isDone: (puzzle) => puzzle.undosDone >= 1,
            findDemo: () => [{ kind: 'tap', targets: [{ on: 'undo' }] }],
        },
        {
            name: 'done',
            text: 'Moor every boat of the fleet. The numbers count the boat cells in each line, and boats never touch. Have fun!',
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

const NO_DEMO: Demo<BoatsTarget> = [];

/** How many cells the sweep's demo drags over. */
const SWEEP_LENGTH = 3;

/** A tap on an unmarked cell of water, from the middle of the harbour out, so the demo is in plain sight. */
function findWaterDemo(puzzle: PuzzleModel): Demo<BoatsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] !== BOAT && puzzle.markAt(c) === 'none');
    return cell < 0 ? NO_DEMO : [{ kind: 'tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** Two taps on a cell with a boat in the solution and none marked, or one tap if it is marked as water already. */
function findBoatDemo(puzzle: PuzzleModel): Demo<BoatsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] === BOAT && puzzle.markAt(c) !== 'boat');
    if (cell < 0) return NO_DEMO;
    return [{ kind: puzzle.markAt(cell) === 'water' ? 'tap' : 'double-tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** A drag across a few unmarked cells of water side by side in a row, from the middle of the harbour out, so the sweep marks them all as water. */
function findSweepDemo(puzzle: PuzzleModel): Demo<BoatsTarget> {
    const { size } = puzzle.puzzle.grid;
    const first = findFromMiddle(puzzle, (cell) => cell % size <= size - SWEEP_LENGTH && isOpenWaterRun(puzzle, cell));
    if (first < 0) return NO_DEMO;
    return [{ kind: 'drag', targets: [toCellMiddle(puzzle, first), toCellMiddle(puzzle, first + SWEEP_LENGTH - 1)] }];
}

/** Whether `first` and the cells after it in its row, `SWEEP_LENGTH` in all, are water in the solution and unmarked. */
function isOpenWaterRun(puzzle: PuzzleModel, first: number): boolean {
    for (let i = 0; i < SWEEP_LENGTH; i++) {
        if (puzzle.puzzle.solution[first + i] === BOAT || puzzle.markAt(first + i) !== 'none') return false;
    }
    return true;
}

/** The cell nearest the middle of the harbour that passes `test`, or -1 if none does. */
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

function toCellMiddle(puzzle: PuzzleModel, cell: number): BoatsTarget {
    const { size } = puzzle.puzzle.grid;
    return { on: 'grid', x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 };
}
