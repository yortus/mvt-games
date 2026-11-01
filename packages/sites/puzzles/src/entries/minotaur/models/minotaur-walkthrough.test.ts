import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type WalkthroughModel } from '../../../shared';
import { PASSAGE, WALL } from './edge-states';
import { makeMazePuzzle } from './make-maze-puzzle';
import type { MazeGrid } from './maze-grid';
import { MINOTAUR_WALKTHROUGH, type MinotaurTarget } from './minotaur-walkthrough';
import { PRACTICE_SEED, PRACTICE_SETTINGS } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';

// Points on the maze are in cells: (0.5, 0.5) is the middle of the top left cell, and (1, 1) its bottom right corner.

describe('Minotaur\'s walkthrough', () => {
    it('shows a drag from the middle of the S cell along the solution\'s path', () => {
        const { puzzle, walkthrough } = setUp();
        const { grid, start, solution } = puzzle.maze;
        expect(walkthrough.stepName).toBe('path');
        const [touch] = walkthrough.demo;
        expect(touch.kind).toBe('drag');
        const cells = touch.targets.map((target) => toCell(grid, target));
        expect(cells[0]).toBe(start);
        for (let i = 0; i + 1 < cells.length; i++) expect(solution[grid.edgeBetween(cells[i], cells[i + 1])]).toBe(PASSAGE);
    });

    it('shows a drag along a wall the solution has, from corner to corner, then a tap on a mark to rub out, then Undo', () => {
        const { puzzle, walkthrough } = setUp();
        const { grid, solution } = puzzle.maze;
        doDemo(puzzle, walkthrough);
        expect(walkthrough.stepName).toBe('wall');
        const corners = walkthrough.demo[0].targets.map((target) => (target.on === 'maze' ? [target.x, target.y] : []));
        expect(corners.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
        doDemo(puzzle, walkthrough);
        expect(walkthrough.stepName).toBe('rub-out');
        const walls = Array.from({ length: grid.edgeCount }, (_, edge) => edge).filter((edge) => puzzle.markAt(edge) === 'wall');
        expect(walls.length).toBeGreaterThan(0);
        expect(walls.every((edge) => solution[edge] === WALL)).toBe(true);
        expect(walkthrough.demo[0].kind).toBe('tap');
        doDemo(puzzle, walkthrough);
        expect(walkthrough.stepName).toBe('undo');
        expect(walkthrough.demo).toEqual([{ kind: 'tap', targets: [{ on: 'undo' }] }]);
        doDemo(puzzle, walkthrough);
        expect(walkthrough.stepName).toBe('done');
        expect(walkthrough.isAtLastStep).toBe(true);
        expect(walkthrough.demo).toEqual([]);
    });
});

function setUp(): { puzzle: PuzzleModel; walkthrough: WalkthroughModel<MinotaurTarget> } {
    const puzzle = createPuzzleModel({ maze: makeMazePuzzle({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS }) });
    return { puzzle, walkthrough: createWalkthroughModel({ practice: puzzle, ...MINOTAUR_WALKTHROUGH }) };
}

/** The cell a point on the maze is in. */
function toCell(grid: MazeGrid, target: MinotaurTarget): number {
    if (target.on !== 'maze') return -1;
    return Math.floor(target.y) * grid.cols + Math.floor(target.x);
}

/** Does what the demo shows, as the gestures would, and lets the walkthrough move on. */
function doDemo(puzzle: PuzzleModel, walkthrough: WalkthroughModel<MinotaurTarget>): void {
    const { grid } = puzzle.maze;
    const [touch] = walkthrough.demo;
    const points = touch.targets.flatMap((target) => (target.on === 'maze' ? [[target.x, target.y]] : []));
    if (touch.targets[0].on === 'undo') puzzle.undo();
    else if (touch.kind === 'tap') {
        // The side whose middle the tap is on
        const [x, y] = points[0];
        const isOnColumnLine = Number.isInteger(x);
        const cell = isOnColumnLine ? Math.floor(y) * grid.cols + x - 1 : (y - 1) * grid.cols + Math.floor(x);
        const edge = grid.edgeBetween(cell, isOnColumnLine ? cell + 1 : cell + grid.cols);
        puzzle.mark(edge, 'unknown');
    }
    else if (Number.isInteger(points[0][0]) && Number.isInteger(points[0][1])) {
        // Along a line from corner to corner: the sides between each two
        for (let i = 0; i + 1 < points.length; i++) {
            const [x, y] = points[i];
            const [nextX] = points[i + 1];
            const edge = nextX === x ? grid.edgeBetween(y * grid.cols + x - 1, y * grid.cols + x) : grid.edgeBetween((y - 1) * grid.cols + x, y * grid.cols + x);
            puzzle.mark(edge, 'wall');
        }
    }
    else {
        for (let i = 0; i + 1 < points.length; i++) {
            const a = toCell(grid, touch.targets[i]);
            const b = toCell(grid, touch.targets[i + 1]);
            puzzle.mark(grid.edgeBetween(a, b), 'passage');
        }
    }
    walkthrough.update(16);
}
