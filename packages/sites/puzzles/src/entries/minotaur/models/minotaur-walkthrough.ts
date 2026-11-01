import type { Demo, DemoTouch, IntroModelOptions } from '../../../shared';
import { PASSAGE, WALL } from './edge-states';
import type { MazeGrid } from './maze-grid';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the walkthrough's arrow touches: a point on the maze, in cells,
 * across and down from its top left corner, such as a cell's middle, a
 * corner of the grid, or the middle of a side, or the Undo button.
 */
export type MinotaurTarget = { readonly on: 'maze'; readonly x: number; readonly y: number } | { readonly on: 'undo' };

/** The walkthrough of drawing a maze: its steps, what their demos are found from, and how to tell targets apart. */
export type MinotaurWalkthrough = Pick<IntroModelOptions<PuzzleModel, MinotaurTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to draw a maze, a step at a time, on a practice maze. Each step asks
 * the player to do one thing, and is done once they have:
 *
 * - `path`: draw two passages or more, with a drag from a cell's middle.
 * - `wall`: draw a wall, with a drag from a corner.
 * - `rub-out`: rub a mark out, with a tap on it.
 * - `undo`: take back the last thing done.
 * - `done`: nothing more to do.
 *
 * The demos follow the practice maze's solution, so what the arrow draws is
 * right: the path from S, and a wall the solution has.
 */
export const MINOTAUR_WALKTHROUGH: MinotaurWalkthrough = {
    steps: [
        {
            name: 'path',
            text: 'Start a drag in the middle of the S cell, and drag through the cells to draw the path. This is a practice maze, so try anything you like.',
            isDone: (puzzle) => puzzle.passagesMarked >= 2,
            findDemo: findPathDemo,
        },
        {
            name: 'wall',
            text: 'Start a drag at a corner of a cell, and drag along the line, to draw a wall.',
            isDone: (puzzle) => puzzle.wallsMarked >= 1,
            findDemo: findWallDemo,
        },
        {
            name: 'rub-out',
            text: 'Tap a wall, or the path, to rub it out.',
            isDone: (puzzle) => puzzle.marksCleared >= 1,
            findDemo: findRubOutDemo,
        },
        {
            name: 'undo',
            text: 'Tap Undo to take back the last thing you did.',
            isDone: (puzzle) => puzzle.undosDone >= 1,
            findDemo: () => [{ kind: 'tap', targets: [{ on: 'undo' }] }],
        },
        {
            name: 'done',
            text: 'Build the maze: one path from S to E through every cell, with the walls the numbers give. Have fun!',
            isDone: () => false,
            findDemo: () => NO_DEMO,
        },
    ],
    findWhenChanged: [(puzzle) => puzzle.changes],
    isSameTarget: (a, b) => (a.on === 'undo' ? b.on === 'undo' : b.on === 'maze' && a.x === b.x && a.y === b.y),
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_DEMO: Demo<MinotaurTarget> = [];

/** How many steps of the path from S the demo draws. */
const PATH_DEMO_STEPS = 3;

/** A drag from the middle of the S cell along the solution's path, a few cells on. */
function findPathDemo(puzzle: PuzzleModel): Demo<MinotaurTarget> {
    const { grid, start, solution } = puzzle.maze;
    const targets = [toCellMiddle(grid, start)];
    let previous = -1;
    let cell = start;
    for (let step = 0; step < PATH_DEMO_STEPS; step++) {
        const next = findNextOnPath(grid, solution, cell, previous);
        if (next < 0) break;
        targets.push(toCellMiddle(grid, next));
        previous = cell;
        cell = next;
    }
    return [{ kind: 'drag', targets }];
}

/** The cell after `cell` along the solution's path, away from `previous`, or -1 at the end. */
function findNextOnPath(grid: MazeGrid, solution: Readonly<Uint8Array>, cell: number, previous: number): number {
    for (let side = 0; side < 4; side++) {
        const edge = grid.cellEdges[cell * 4 + side];
        if (edge < 0 || solution[edge] !== PASSAGE) continue;
        const other = grid.edgeCellA[edge] === cell ? grid.edgeCellB[edge] : grid.edgeCellA[edge];
        if (other !== previous) return other;
    }
    return -1;
}

/**
 * A drag along a wall the solution has and the player hasn't drawn, from
 * corner to corner, two sides long where the wall goes on, from the middle
 * of the maze out, so the demo is in plain sight.
 */
function findWallDemo(puzzle: PuzzleModel): Demo<MinotaurTarget> {
    const { grid, solution } = puzzle.maze;
    const isToDraw = (edge: number): boolean => solution[edge] === WALL && puzzle.markAt(edge) === 'unknown';
    for (let i = 0; i < grid.edgeCount; i++) {
        const edge = (Math.floor(grid.edgeCount / 2) + i) % grid.edgeCount;
        if (!isToDraw(edge)) continue;
        const line = grid.lineEdges[grid.edgeLine[edge]];
        const place = line.indexOf(edge);
        const length = place + 1 < line.length && isToDraw(line[place + 1]) ? 2 : 1;
        const targets: MinotaurTarget[] = [];
        for (let j = 0; j <= length; j++) targets.push(toCornerAlong(grid, edge, j));
        return [{ kind: 'drag', targets }];
    }
    return NO_DEMO;
}

/** A tap on the middle of a wall drawn, or failing one, of a passage drawn. */
function findRubOutDemo(puzzle: PuzzleModel): Demo<MinotaurTarget> {
    const { grid } = puzzle.maze;
    let passage = -1;
    for (let edge = 0; edge < grid.edgeCount; edge++) {
        const mark = puzzle.markAt(edge);
        if (mark === 'wall') return [tapOn(toSideMiddle(grid, edge))];
        if (mark === 'passage' && passage < 0) passage = edge;
    }
    return passage < 0 ? NO_DEMO : [tapOn(toSideMiddle(grid, passage))];
}

function tapOn(target: MinotaurTarget): DemoTouch<MinotaurTarget> {
    return { kind: 'tap', targets: [target] };
}

function toCellMiddle(grid: MazeGrid, cell: number): MinotaurTarget {
    return { on: 'maze', x: (cell % grid.cols) + 0.5, y: Math.floor(cell / grid.cols) + 0.5 };
}

/** The middle of the side `edge` is, where a wall along it and a passage across it meet. */
function toSideMiddle(grid: MazeGrid, edge: number): MinotaurTarget {
    const cell = grid.edgeCellA[edge];
    const col = cell % grid.cols;
    const row = Math.floor(cell / grid.cols);
    return grid.isEdgeBetweenColumns(edge) ? { on: 'maze', x: col + 1, y: row + 0.5 } : { on: 'maze', x: col + 0.5, y: row + 1 };
}

/** The corner `steps` sides along the line from the start of `edge`: down a line between columns, or across a line between rows. */
function toCornerAlong(grid: MazeGrid, edge: number, steps: number): MinotaurTarget {
    const cell = grid.edgeCellA[edge];
    const col = cell % grid.cols;
    const row = Math.floor(cell / grid.cols);
    return grid.isEdgeBetweenColumns(edge) ? { on: 'maze', x: col + 1, y: row + steps } : { on: 'maze', x: col + steps, y: row + 1 };
}
