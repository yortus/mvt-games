import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type WalkthroughModel } from '../../../shared';
import { PASSAGE, WALL } from './edge-states';
import { makeMazePuzzle } from './make-maze-puzzle';
import type { MazeGrid } from './maze-grid';
import { MINOTAUR_WALKTHROUGH, type MinotaurTarget } from './minotaur-walkthrough';
import { PRACTICE_SEED, PRACTICE_SETTINGS } from './model-constants';
import { createPuzzleModel, type EdgeMark, type PuzzleModel } from './puzzle-model';

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

    it('shows a drag along a wall the solution has, from corner to corner, then a drag over it again to rub it out, then Undo', () => {
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
        const [rubOut] = walkthrough.demo;
        expect(rubOut.kind).toBe('drag');
        expect(rubOut.targets.length).toBe(2);
        doDemo(puzzle, walkthrough);
        expect(walkthrough.stepName).toBe('undo');
        expect(walls.some((edge) => puzzle.markAt(edge) === 'unknown')).toBe(true);
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

/**
 * Does what the demo shows, as the gestures would, and lets the walkthrough
 * move on. A drag draws, unless the first edge it steps over is marked with
 * what it draws already: then it rubs that kind of mark out.
 */
function doDemo(puzzle: PuzzleModel, walkthrough: WalkthroughModel<MinotaurTarget>): void {
    const { grid } = puzzle.maze;
    const [touch] = walkthrough.demo;
    if (touch.targets[0].on === 'undo') puzzle.undo();
    else {
        const points = touch.targets.flatMap((target) => (target.on === 'maze' ? [[target.x, target.y]] : []));
        const isAlongLines = Number.isInteger(points[0][0]) && Number.isInteger(points[0][1]);
        const drawing: EdgeMark = isAlongLines ? 'wall' : 'passage';
        const edges: number[] = [];
        for (let i = 0; i + 1 < points.length; i++) {
            const [x, y] = points[i];
            const [nextX] = points[i + 1];
            if (!isAlongLines) edges.push(grid.edgeBetween(toCell(grid, touch.targets[i]), toCell(grid, touch.targets[i + 1])));
            // Along a line from corner to corner: the side between the two
            else if (nextX === x) edges.push(grid.edgeBetween(y * grid.cols + x - 1, y * grid.cols + x));
            else edges.push(grid.edgeBetween((y - 1) * grid.cols + x, y * grid.cols + x));
        }
        const isRubbingOut = puzzle.markAt(edges[0]) === drawing;
        for (const edge of edges) {
            if (!isRubbingOut) puzzle.mark(edge, drawing);
            else if (puzzle.markAt(edge) === drawing) puzzle.mark(edge, 'unknown');
        }
    }
    walkthrough.update(16);
}
