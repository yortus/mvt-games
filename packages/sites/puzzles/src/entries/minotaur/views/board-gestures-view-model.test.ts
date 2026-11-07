import { describe, expect, it } from 'vitest';
import { type EdgeMark, LEVEL_SETTINGS, makeMazePuzzle } from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';

// Positions are in cells from the maze's top left corner: (0.5, 0.5) is the middle of the top left cell, and (1, 1) its bottom right corner.

const { grid } = makeMazePuzzle({ seed: 1, settings: LEVEL_SETTINGS.easy });
const { cols } = grid;

describe('BoardGesturesViewModel', () => {
    it('draws passages between the cells a drag from a cell\'s middle passes through, as one stroke', () => {
        const board = createBoard();
        drag(board, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5]]);
        expect(board.passages()).toEqual([grid.edgeBetween(0, 1), grid.edgeBetween(1, 1 + cols)].sort(byNumber));
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('steps one cell at a time when a drag skips ahead, and only through cells it passes near the middle of', () => {
        const board = createBoard();
        // Past the corner between cells, then on two cells at once
        drag(board, [[0.5, 0.5], [0.97, 0.97], [2.5, 0.5]]);
        expect(board.passages()).toEqual([grid.edgeBetween(0, 1), grid.edgeBetween(1, 2)].sort(byNumber));
    });

    it('leaves what a drag drew as it goes back over it', () => {
        const board = createBoard();
        drag(board, [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [1.5, 0.5]]);
        expect(board.passages()).toEqual([grid.edgeBetween(0, 1), grid.edgeBetween(1, 2)].sort(byNumber));
    });

    it('draws walls along the lines a drag from a corner follows, from corner to corner, but not on the border', () => {
        const board = createBoard();
        // Along the line between the first two columns, from the top, then off along the line between the second and third rows
        drag(board, [[1.05, 0.1], [1, 1], [1, 2], [1.02, 1.98], [2, 2]]);
        expect(board.walls()).toEqual([grid.edgeBetween(0, 1), grid.edgeBetween(cols, cols + 1), grid.edgeBetween(cols + 1, 2 * cols + 1)].sort(byNumber));
        const border = createBoard();
        drag(border, [[0, 0], [3, 0]]);
        expect(border.walls()).toEqual([]);
    });

    it('tells a drag for walls from a drag for the path by whether it starts nearer a corner or a cell\'s middle', () => {
        const board = createBoard();
        // Just off the middle of a side, towards the top corner, then down the line
        drag(board, [[1.02, 0.3], [1, 1]]);
        expect(board.walls()).toEqual([grid.edgeBetween(0, 1)]);
        const path = createBoard();
        // Just off the middle of a side, towards the cell's middle, then across
        drag(path, [[0.85, 0.5], [1.5, 0.5]]);
        expect(path.passages()).toEqual([grid.edgeBetween(0, 1)]);
    });

    it('rubs out the passages a drag from a cell\'s middle steps over, when the first is drawn already, as one stroke', () => {
        const board = createBoard();
        const drawn = [grid.edgeBetween(0, 1), grid.edgeBetween(1, 2)];
        for (const edge of drawn) board.marks.set(edge, 'passage');
        // On into a cell with no passage to it, which stays that way
        drag(board, [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.5]]);
        expect(board.passages()).toEqual([]);
        expect(board.marks.has(grid.edgeBetween(2, 3))).toBe(false);
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('rubs out the walls a drag from a corner runs along, when the first is drawn already, and leaves the path', () => {
        const board = createBoard();
        const passage = grid.edgeBetween(2 * cols, 2 * cols + 1);
        board.marks.set(grid.edgeBetween(0, 1), 'wall');
        board.marks.set(grid.edgeBetween(cols, cols + 1), 'wall');
        board.marks.set(passage, 'passage');
        // Down the line between the first two columns, over the passage crossing it in the third row
        drag(board, [[1, 0], [1, 1], [1, 2], [1, 3]]);
        expect(board.walls()).toEqual([]);
        expect(board.passages()).toEqual([passage]);
    });

    it('draws over marks already there, when the first edge it steps over has none', () => {
        const board = createBoard();
        const drawn = grid.edgeBetween(1, 2);
        board.marks.set(drawn, 'passage');
        drag(board, [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5]]);
        expect(board.passages()).toEqual([grid.edgeBetween(0, 1), drawn].sort(byNumber));
    });

    it('does nothing for a press let go where it went down', () => {
        const board = createBoard();
        const wall = grid.edgeBetween(0, 1);
        board.marks.set(wall, 'wall');
        board.gestures.press(1, 0.95, 0.5);
        board.gestures.release(1);
        expect(board.marks.get(wall)).toBe('wall');
        expect(board.strokes).toEqual([]);
    });
});

interface TestBoard {
    readonly gestures: ReturnType<typeof createBoardGesturesViewModel>;
    readonly marks: Map<number, EdgeMark>;
    readonly strokes: string[];
    readonly passages: () => number[];
    readonly walls: () => number[];
}

function createBoard(): TestBoard {
    const marks = new Map<number, EdgeMark>();
    const strokes: string[] = [];
    const gestures = createBoardGesturesViewModel({
        grid,
        markAt: (edge) => marks.get(edge) ?? 'unknown',
        onStrokeStarted: () => strokes.push('start'),
        onEdgeMarked: (edge, mark) => marks.set(edge, mark),
        onStrokeFinished: () => strokes.push('finish'),
    });
    const listMarked = (mark: EdgeMark) => (): number[] => [...marks].filter(([, each]) => each === mark).map(([edge]) => edge).sort(byNumber);
    return { gestures, marks, strokes, passages: listMarked('passage'), walls: listMarked('wall') };
}

function drag(board: TestBoard, points: readonly (readonly [number, number])[]): void {
    board.gestures.press(1, points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) board.gestures.move(1, points[i][0], points[i][1]);
    board.gestures.release(1);
}

function byNumber(a: number, b: number): number {
    return a - b;
}
