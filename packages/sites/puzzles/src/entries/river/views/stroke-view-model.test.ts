import { describe, expect, it } from 'vitest';
import { createStrokeViewModel } from './stroke-view-model';

// The board's gestures decide which edges a drag goes over, so these tests name the edges directly.

describe('StrokeViewModel', () => {
    it('draws the river across the edges a drag goes over, as one stroke', () => {
        const board = createBoard();
        stroke(board, [1, 2, 3]);
        expect(board.drawn()).toEqual([1, 2, 3]);
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('leaves what a drag drew as it goes back over it', () => {
        const board = createBoard();
        stroke(board, [1, 2, 2, 1]);
        expect(board.drawn()).toEqual([1, 2]);
    });

    it('rubs out the river from the edges a drag goes over, when the first has river already', () => {
        const board = createBoard();
        board.rivers.add(1);
        board.rivers.add(2);
        // It goes on over an edge without river, which stays that way
        stroke(board, [1, 2, 3]);
        expect(board.drawn()).toEqual([]);
        expect(board.strokes).toEqual(['start', 'finish']);
    });

    it('draws over river already there, when the first edge it goes over is still clear', () => {
        const board = createBoard();
        board.rivers.add(2);
        stroke(board, [1, 2]);
        expect(board.drawn()).toEqual([1, 2]);
    });

    it('starts a stroke only for a drag that changes an edge, and decides afresh for each drag', () => {
        const board = createBoard();
        board.stroke.finish();
        expect(board.strokes).toEqual([]);
        board.rivers.add(1);
        stroke(board, [1]);
        expect(board.drawn()).toEqual([]);
        stroke(board, [1]);
        expect(board.drawn()).toEqual([1]);
        expect(board.strokes).toEqual(['start', 'finish', 'start', 'finish']);
    });

    it('passes over the edges a given fixes, so the first edge it can change decides what it does', () => {
        const board = createBoard();
        // A drag out of a printed piece of river, whose edge 1 has river and can't change
        board.rivers.add(1);
        board.fixed.add(1);
        stroke(board, [1, 2, 3]);
        expect(board.drawn()).toEqual([1, 2, 3]);
        // A drag over fixed edges alone doesn't change anything or start a stroke
        stroke(board, [1]);
        expect(board.strokes).toEqual(['start', 'finish']);
    });
});

interface TestBoard {
    readonly stroke: ReturnType<typeof createStrokeViewModel>;
    readonly rivers: Set<number>;
    readonly fixed: Set<number>;
    readonly strokes: string[];
    readonly drawn: () => number[];
}

function createBoard(): TestBoard {
    const rivers = new Set<number>();
    const fixed = new Set<number>();
    const strokes: string[] = [];
    const strokeViewModel = createStrokeViewModel({
        isRiverAt: (edge) => rivers.has(edge),
        isEdgeFixedAt: (edge) => fixed.has(edge),
        onStrokeStarted: () => strokes.push('start'),
        onRiverSet: (edge, isRiver) => (isRiver ? rivers.add(edge) : rivers.delete(edge)),
        onStrokeFinished: () => strokes.push('finish'),
    });
    const drawn = (): number[] => [...rivers].sort((a, b) => a - b);
    return { stroke: strokeViewModel, rivers, fixed, strokes, drawn };
}

function stroke(board: TestBoard, edges: readonly number[]): void {
    for (const edge of edges) board.stroke.markOver(edge);
    board.stroke.finish();
}
