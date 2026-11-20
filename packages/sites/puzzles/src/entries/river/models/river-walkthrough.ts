import type { Demo, IntroModelOptions } from '../../../shared';
import type { PuzzleModel } from './puzzle-model';
import { DRY, RIVER } from './river-states';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the walkthrough's arrow points at. It is a point on the valley, in cells across and down from its top left corner, or the Undo button. */
export type RiverTarget = { readonly on: 'grid'; readonly x: number; readonly y: number } | { readonly on: 'undo' };

/** The walkthrough of the controls. It holds the steps, how their demos are found, and how to tell targets apart. */
export type RiverWalkthrough = Pick<IntroModelOptions<PuzzleModel, RiverTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to draw a river, a step at a time, on a practice puzzle. Each step
 * shows the player one thing to do, and ends once they have done it. These
 * are the steps.
 *
 * - `meadow`: mark a cell as meadow, with a tap.
 * - `river`: draw the river from one cell to the next, with a drag.
 * - `rub`: rub out the river, with a drag over it.
 * - `undo`: take back the last thing done.
 * - `done`: nothing more to do.
 *
 * The demos follow the practice puzzle's solution, so the arrow shows the
 * right marks. It shows meadow where the river keeps away, and river where
 * it runs.
 */
export const RIVER_WALKTHROUGH: RiverWalkthrough = {
    steps: [
        {
            name: 'meadow',
            text: 'Tap a cell to plant a flower, which marks a cell the river doesn\'t pass through. This is only practice, so try anything.',
            isDone: (puzzle) => puzzle.meadowsMarked >= 1,
            findDemo: findMeadowDemo,
        },
        {
            name: 'river',
            text: 'Drag from a cell to the one beside it to draw the river between them. Keep dragging to draw it further.',
            isDone: (puzzle) => puzzle.riverDrawn >= 1,
            findDemo: findRiverDemo,
        },
        {
            name: 'rub',
            text: 'Drag along the river you drew to rub it out again.',
            isDone: (puzzle) => puzzle.riverCleared >= 1,
            findDemo: findRubDemo,
        },
        {
            name: 'undo',
            text: 'Tap Undo to take back the last thing you did.',
            isDone: (puzzle) => puzzle.undosDone >= 1,
            findDemo: () => [{ kind: 'tap', targets: [{ on: 'undo' }] }],
        },
        {
            name: 'done',
            text: 'Draw a river from the spring to the sea. The numbers count the river\'s cells in each line. Have fun!',
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

const NO_DEMO: Demo<RiverTarget> = [];

/** Returns a tap on an unmarked dry cell, near the middle of the valley, so the demo is in plain sight. */
function findMeadowDemo(puzzle: PuzzleModel): Demo<RiverTarget> {
    const cell = findCellFromMiddle(puzzle, (c) => puzzle.puzzle.solutionCells[c] === DRY && !puzzle.isMeadowAt(c) && !puzzle.isGivenAt(c));
    return cell < 0 ? NO_DEMO : [{ kind: 'tap', targets: [toCellMiddle(puzzle, cell)] }];
}

/** Returns a drag across an edge near the middle of the valley that the river crosses in the solution, and that the player can still draw. */
function findRiverDemo(puzzle: PuzzleModel): Demo<RiverTarget> {
    const edge = findEdgeFromMiddle(puzzle, (e) => puzzle.puzzle.solutionEdges[e] === RIVER && !puzzle.isRiverAt(e) && !puzzle.isEdgeFixedAt(e));
    return edge < 0 ? NO_DEMO : toDrag(puzzle, edge);
}

/** Returns a drag across an edge that the player drew the river across. */
function findRubDemo(puzzle: PuzzleModel): Demo<RiverTarget> {
    const edge = findEdgeFromMiddle(puzzle, (e) => puzzle.isRiverAt(e) && !puzzle.isEdgeFixedAt(e));
    return edge < 0 ? NO_DEMO : toDrag(puzzle, edge);
}

/** Returns a drag from the middle of one of `edge`'s cells to the middle of the other. */
function toDrag(puzzle: PuzzleModel, edge: number): Demo<RiverTarget> {
    const { edgeCellA, edgeCellB } = puzzle.puzzle.grid;
    return [{ kind: 'drag', targets: [toCellMiddle(puzzle, edgeCellA[edge]), toCellMiddle(puzzle, edgeCellB[edge])] }];
}

/** Returns the edge nearest the middle of the valley that passes `test`, or -1 if every edge fails it. */
function findEdgeFromMiddle(puzzle: PuzzleModel, test: (edge: number) => boolean): number {
    const { grid } = puzzle.puzzle;
    const middle = (grid.size - 1) / 2;
    let best = -1;
    let bestDistance = Infinity;
    for (let edge = 0; edge < grid.edgeCount; edge++) {
        if (!test(edge)) continue;
        const a = grid.edgeCellA[edge];
        const distance = Math.abs(Math.floor(a / grid.size) - middle) + Math.abs((a % grid.size) - middle);
        if (distance < bestDistance) {
            best = edge;
            bestDistance = distance;
        }
    }
    return best;
}

/** Returns the cell nearest the middle of the valley that passes `test`, or -1 if every cell fails it. */
function findCellFromMiddle(puzzle: PuzzleModel, test: (cell: number) => boolean): number {
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

/** Returns the point in the middle of `cell`. */
function toCellMiddle(puzzle: PuzzleModel, cell: number): RiverTarget {
    const { size } = puzzle.puzzle.grid;
    return { on: 'grid', x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 };
}
