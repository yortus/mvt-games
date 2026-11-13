import { describe, expect, it } from 'vitest';
import { LEVEL_SETTINGS, createMazePuzzle } from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';

// Positions are in cells from the maze's top left corner: (0.5, 0.5) is the middle of the top left cell, and (1, 1) its bottom right corner.

const { grid } = createMazePuzzle({ seed: 1, settings: LEVEL_SETTINGS.easy });
const { cols } = grid;

describe('BoardGesturesViewModel', () => {
    it('goes over the edges between the cells a drag from a cell\'s middle passes through, drawing the path', () => {
        const board = createBoard();
        drag(board, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5]]);
        expect(board.events).toEqual([`passage ${grid.edgeBetween(0, 1)}`, `passage ${grid.edgeBetween(1, 1 + cols)}`, 'finish']);
    });

    it('steps one cell at a time when a drag skips ahead, and only through cells it passes near the middle of', () => {
        const board = createBoard();
        // Past the corner between cells, then on two cells at once
        drag(board, [[0.5, 0.5], [0.97, 0.97], [2.5, 0.5]]);
        expect(board.events).toEqual([`passage ${grid.edgeBetween(0, 1)}`, `passage ${grid.edgeBetween(1, 2)}`, 'finish']);
    });

    it('goes along the edges a drag from a corner follows, from corner to corner, drawing walls, but over none on the border', () => {
        const board = createBoard();
        // Along the line between the first two columns, from the top, then off along the line between the second and third rows
        drag(board, [[1.05, 0.1], [1, 1], [1, 2], [1.02, 1.98], [2, 2]]);
        expect(board.events).toEqual([
            `wall ${grid.edgeBetween(0, 1)}`, `wall ${grid.edgeBetween(cols, cols + 1)}`, `wall ${grid.edgeBetween(cols + 1, 2 * cols + 1)}`, 'finish',
        ]);
        const border = createBoard();
        drag(border, [[0, 0], [3, 0]]);
        expect(border.events).toEqual(['finish']);
    });

    it('tells a drag for walls from a drag for the path by whether it starts nearer a corner or a cell\'s middle', () => {
        const board = createBoard();
        // Just off the middle of a side, towards the top corner, then down the line
        drag(board, [[1.02, 0.3], [1, 1]]);
        expect(board.events).toEqual([`wall ${grid.edgeBetween(0, 1)}`, 'finish']);
        const path = createBoard();
        // Just off the middle of a side, towards the cell's middle, then across
        drag(path, [[0.85, 0.5], [1.5, 0.5]]);
        expect(path.events).toEqual([`passage ${grid.edgeBetween(0, 1)}`, 'finish']);
    });

    it('starts a wall at a corner of the border from a press just outside the maze', () => {
        const board = createBoard();
        drag(board, [[1, -0.3], [1, 1]]);
        expect(board.events).toEqual([`wall ${grid.edgeBetween(0, 1)}`, 'finish']);
    });

    it('finishes a drag that is cancelled, and reports nothing for a press let go where it went down', () => {
        const board = createBoard();
        board.gestures.press(0.5, 0.5);
        board.gestures.move(1.5, 0.5);
        board.gestures.cancel();
        board.gestures.press(0.95, 0.5);
        board.gestures.release();
        expect(board.events).toEqual([`passage ${grid.edgeBetween(0, 1)}`, 'finish']);
    });
});

interface TestBoard {
    readonly gestures: ReturnType<typeof createBoardGesturesViewModel>;
    readonly events: string[];
}

function createBoard(): TestBoard {
    const events: string[] = [];
    const gestures = createBoardGesturesViewModel({
        grid,
        onDraggedOver: (edge, mark) => events.push(`${mark} ${edge}`),
        onDragFinished: () => events.push('finish'),
    });
    return { gestures, events };
}

function drag(board: TestBoard, points: readonly (readonly [number, number])[]): void {
    board.gestures.press(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) board.gestures.move(points[i][0], points[i][1]);
    board.gestures.release();
}
