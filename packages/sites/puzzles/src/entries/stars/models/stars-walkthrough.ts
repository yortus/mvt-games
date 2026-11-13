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
 * - `dot`: put a dot in a cell, with a tap.
 * - `star`: place a star, with two taps.
 * - `drag`: dot two cells or more, with a drag.
 * - `undo`: take back the last thing done.
 * - `done`: nothing more to do.
 *
 * The demos follow the practice puzzle's solution, so what the arrow marks
 * is right: a dot where there is no star, and a star where there is one.
 */
export const STARS_WALKTHROUGH: StarsWalkthrough = {
    steps: [
        {
            name: 'dot',
            text: 'Tap a cell to put a dot in it: your note that it has no star. This is a practice puzzle, so try anything.',
            isDone: (puzzle) => puzzle.dotsMarked >= 1,
            findDemo: findDotDemo,
        },
        {
            name: 'star',
            text: 'Tap a cell twice to place a star. A third tap clears it.',
            isDone: (puzzle) => puzzle.starsPlaced >= 1,
            findDemo: findStarDemo,
        },
        {
            name: 'drag',
            text: 'Stars never touch, not even at a corner. Drag across the cells around a star to dot them all.',
            isDone: (puzzle) => puzzle.strokeDots >= 2,
            findDemo: findDragDemo,
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

/** How many cells the drag demo dots. */
const DRAG_DEMO_CELLS = 3;

/** A cell's eight neighbours, in order round it from the top, as steps across and down, so each is next to the one before. */
const RING: readonly (readonly [number, number])[] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/** A tap on an unmarked cell with no star, from the middle of the grid out, so the demo is in plain sight. */
function findDotDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] !== STAR && puzzle.markAt(c) === 'none');
    return cell < 0 ? NO_DEMO : [{ kind: 'tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** Two taps on a cell with a star in the solution and none placed, or one tap if it has a dot already. */
function findStarDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const cell = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] === STAR && puzzle.markAt(c) !== 'star');
    if (cell < 0) return NO_DEMO;
    return [{ kind: puzzle.markAt(cell) === 'dot' ? 'tap' : 'double-tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** A drag over a few unmarked cells round a star placed, or round one of the solution's if none is placed. */
function findDragDemo(puzzle: PuzzleModel): Demo<StarsTarget> {
    const { size } = puzzle.puzzle.grid;
    let star = findFromMiddle(puzzle, (c) => puzzle.markAt(c) === 'star');
    if (star < 0) star = findFromMiddle(puzzle, (c) => puzzle.puzzle.solution[c] === STAR);
    if (star < 0) return NO_DEMO;
    const targets: StarsTarget[] = [];
    const row = Math.floor(star / size);
    const col = star % size;
    for (let i = 0; i < RING.length && targets.length < DRAG_DEMO_CELLS; i++) {
        const r = row + RING[i][1];
        const c = col + RING[i][0];
        if (r < 0 || r >= size || c < 0 || c >= size || puzzle.markAt(r * size + c) !== 'none') continue;
        targets.push(toCellMiddle(puzzle, r * size + c));
    }
    return targets.length < 2 ? NO_DEMO : [{ kind: 'drag', targets }];
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
