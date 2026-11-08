import { describe, expect, it } from 'vitest';
import { createGridGesturesViewModel, type GridGesturesViewModelOptions } from './grid-gestures-view-model';

// Positions are in cells from the grid's top left corner: (0.5, 0.5) is the middle of the top left cell, and
// (1, 1) its bottom right corner. Cells are numbered COLS to a row, and corners COLS + 1 to a row.

const ROWS = 4;
const COLS = 5;

describe('GridGesturesViewModel', () => {
    it('reports a press let go with no step as a tap on the cell it landed in, where it landed', () => {
        const grid = createGrid();
        grid.gestures.press(1.9, 0.2);
        grid.gestures.move(1.8, 0.3);
        grid.gestures.release();
        expect(grid.events).toEqual(['tap 1 at 1.9,0.2']);
    });

    it('steps from cell to cell as a drag passes through their middles, then finishes', () => {
        const grid = createGrid();
        drag(grid, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5]]);
        expect(grid.events).toEqual(['step 0-1', `step 1-${1 + COLS}`, 'finish']);
    });

    it('steps one cell at a time, the longer way first, when a fast drag skips ahead', () => {
        const grid = createGrid();
        drag(grid, [[0.5, 0.5], [2.5, 1.5]]);
        expect(grid.events).toEqual(['step 0-1', 'step 1-2', `step 2-${2 + COLS}`, 'finish']);
    });

    it('steps diagonally too, when it steps eight ways', () => {
        const grid = createGrid({ steps: 'eight-way' });
        drag(grid, [[0.5, 0.5], [2.5, 1.5]]);
        expect(grid.events).toEqual([`step 0-${1 + COLS}`, `step ${1 + COLS}-${2 + COLS}`, 'finish']);
    });

    it('reaches only the cells it passes near the middle of, so a drag past a corner takes no cell in', () => {
        const reach = 0.38;
        const grid = createGrid({ steps: 'eight-way', cellReach: reach });
        // Past the corner between four cells, on to the cell corner to corner
        drag(grid, [[0.5, 0.5], [0.9, 0.95], [1.05, 1.1], [1.5, 1.5]]);
        expect(grid.events).toEqual([`step 0-${1 + COLS}`, 'finish']);
        const fourWay = createGrid({ cellReach: reach });
        drag(fourWay, [[0.5, 0.5], [0.97, 0.97], [2.5, 0.5]]);
        expect(fourWay.events).toEqual(['step 0-1', 'step 1-2', 'finish']);
    });

    it('follows corners from a press nearer a corner than a cell\'s middle, when set to find the nearest', () => {
        const grid = createGrid({ lattice: 'nearest' });
        const corner = (row: number, col: number): number => row * (COLS + 1) + col;
        // Down the line between the first two columns, then along the line below the second row
        drag(grid, [[1.05, 0.1], [1, 1], [1, 2], [2, 2]]);
        expect(grid.events).toEqual([
            `step ${corner(0, 1)}-${corner(1, 1)}`, `step ${corner(1, 1)}-${corner(2, 1)}`, `step ${corner(2, 1)}-${corner(2, 2)}`, 'finish',
        ]);
        expect(grid.gestures.lattice).toBe('corners');
        const cells = createGrid({ lattice: 'nearest' });
        drag(cells, [[0.85, 0.5], [1.5, 0.5]]);
        expect(cells.events).toEqual(['step 0-1', 'finish']);
        expect(cells.gestures.lattice).toBe('cells');
    });

    it('takes a press off the grid as nearest a corner, and starts a drag from the first place it reaches', () => {
        const grid = createGrid({ lattice: 'nearest' });
        grid.gestures.press(-0.3, 1.1);
        expect(grid.gestures.lattice).toBe('corners');
        expect(grid.gestures.pressedPlace).toBe(COLS + 1);
        const cells = createGrid();
        drag(cells, [[-0.2, 0.5], [0.5, 0.5], [1.5, 0.5]]);
        expect(cells.gestures.pressedPlace).toBe(-1);
        expect(cells.events).toEqual(['step 0-1', 'finish']);
    });

    it('reports a cancel after a step as a drag cancelled, and a cancel before one as nothing', () => {
        const grid = createGrid();
        grid.gestures.press(0.5, 0.5);
        grid.gestures.move(1.5, 0.5);
        grid.gestures.cancel();
        grid.gestures.press(0.5, 0.5);
        grid.gestures.cancel();
        expect(grid.events).toEqual(['step 0-1', 'cancel']);
    });

    it('ignores a press while it is not enabled, and a second press while one is followed', () => {
        let isEnabled = false;
        const grid = createGrid({ isEnabled: () => isEnabled });
        drag(grid, [[0.5, 0.5], [1.5, 0.5]]);
        expect(grid.events).toEqual([]);
        isEnabled = true;
        grid.gestures.press(0.5, 0.5);
        grid.gestures.press(3.5, 3.5);
        grid.gestures.release();
        expect(grid.events).toEqual(['tap 0 at 0.5,0.5']);
    });

    it('keeps where the last press landed and where its drag reached until the next press, and follows the pointer', () => {
        const grid = createGrid();
        drag(grid, [[0.5, 0.5], [1.5, 0.5], [1.6, 0.7]]);
        expect(grid.gestures.isPressed).toBe(false);
        expect(grid.gestures.pressedPlace).toBe(0);
        expect(grid.gestures.place).toBe(1);
        expect([grid.gestures.x, grid.gestures.y]).toEqual([1.6, 0.7]);
    });
});

interface TestGrid {
    readonly gestures: ReturnType<typeof createGridGesturesViewModel>;
    readonly events: string[];
}

function createGrid(more: Partial<GridGesturesViewModelOptions> = {}): TestGrid {
    const events: string[] = [];
    const gestures = createGridGesturesViewModel({
        rows: ROWS,
        cols: COLS,
        lattice: 'cells',
        steps: 'four-way',
        onTapped: (place, x, y) => events.push(`tap ${place} at ${x},${y}`),
        onStepped: (from, to) => events.push(`step ${from}-${to}`),
        onDragFinished: () => events.push('finish'),
        onDragCancelled: () => events.push('cancel'),
        ...more,
    });
    return { gestures, events };
}

function drag(grid: TestGrid, points: readonly (readonly [number, number])[]): void {
    grid.gestures.press(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) grid.gestures.move(points[i][0], points[i][1]);
    grid.gestures.release();
}
