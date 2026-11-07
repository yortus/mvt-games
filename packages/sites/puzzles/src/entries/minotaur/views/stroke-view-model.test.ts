import { describe, expect, it } from 'vitest';
import type { EdgeMark } from '../models';
import { createStrokeViewModel } from './stroke-view-model';

// Edges are numbered as a maze numbers them. Which edges a drag goes over is the board's gestures' to say, so
// these tests name the edges directly.

describe('StrokeViewModel', () => {
    it('draws on the edges a drag goes over, as one stroke', () => {
        const board = createBoard();
        stroke(board, 'passage', [1, 2, 3]);
        expect(board.marked('passage')).toEqual([1, 2, 3]);
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('leaves what a drag drew as it goes back over it', () => {
        const board = createBoard();
        stroke(board, 'passage', [1, 2, 2, 1]);
        expect(board.marked('passage')).toEqual([1, 2]);
    });

    it('rubs out the marks it draws from the edges a drag goes over, when the first is drawn already', () => {
        const board = createBoard();
        board.marks.set(1, 'passage');
        board.marks.set(2, 'passage');
        // On over an edge with no passage, which stays that way
        stroke(board, 'passage', [1, 2, 3]);
        expect(board.marked('passage')).toEqual([]);
        expect(board.marks.has(3)).toBe(false);
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('rubs out only the kind of mark it draws, and leaves the other', () => {
        const board = createBoard();
        board.marks.set(1, 'wall');
        board.marks.set(2, 'passage');
        stroke(board, 'wall', [1, 2]);
        expect(board.marked('wall')).toEqual([]);
        expect(board.marked('passage')).toEqual([2]);
    });

    it('draws over marks already there, when the first edge it goes over has none', () => {
        const board = createBoard();
        board.marks.set(2, 'passage');
        stroke(board, 'passage', [1, 2]);
        expect(board.marked('passage')).toEqual([1, 2]);
    });

    it('starts no stroke for a drag over no edges, and decides afresh for each drag', () => {
        const board = createBoard();
        board.stroke.finish();
        expect(board.strokes).toEqual([]);
        board.marks.set(1, 'passage');
        stroke(board, 'passage', [1]);
        expect(board.marked('passage')).toEqual([]);
        stroke(board, 'passage', [1]);
        expect(board.marked('passage')).toEqual([1]);
        expect(board.strokes).toEqual(['start', 'finish', 'start', 'finish']);
    });
});

interface TestBoard {
    readonly stroke: ReturnType<typeof createStrokeViewModel>;
    readonly marks: Map<number, EdgeMark>;
    readonly strokes: string[];
    readonly marked: (mark: EdgeMark) => number[];
}

function createBoard(): TestBoard {
    const marks = new Map<number, EdgeMark>();
    const strokes: string[] = [];
    const strokeViewModel = createStrokeViewModel({
        markAt: (edge) => marks.get(edge) ?? 'unknown',
        onStrokeStarted: () => strokes.push('start'),
        onEdgeMarked: (edge, mark) => (mark === 'unknown' ? marks.delete(edge) : marks.set(edge, mark)),
        onStrokeFinished: () => strokes.push('finish'),
    });
    const marked = (mark: EdgeMark): number[] => [...marks].filter(([, each]) => each === mark).map(([edge]) => edge).sort((a, b) => a - b);
    return { stroke: strokeViewModel, marks, strokes, marked };
}

function stroke(board: TestBoard, mark: 'passage' | 'wall', edges: readonly number[]): void {
    for (const edge of edges) board.stroke.markOver(edge, mark);
    board.stroke.finish();
}
