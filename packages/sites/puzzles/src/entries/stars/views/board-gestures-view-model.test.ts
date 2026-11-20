import { describe, expect, it } from 'vitest';
import { createBoardGesturesViewModel } from './board-gestures-view-model';

// Positions are in cells: (0.5, 0.5) is the middle of the top left cell. On a
// 6 by 6 grid, cell 7 is the second cell of the second row.

describe('createBoardGesturesViewModel', () => {
    it('reports a tap as its cell, and a drag as the cells it went over once let go, going round a diagonal step', () => {
        const { gestures, taps, drags } = setUp();
        gestures.press(1.5, 1.5);
        gestures.release();
        dragThrough(gestures, [[0.5, 0.5], [1.5, 0.5], [2.5, 1.5]]);
        expect(taps).toEqual([7]);
        expect(drags).toEqual([[0, 1, 2, 8]]);
        expect(gestures.draggedCells).toEqual([]);
    });

    it('lets the last cell go when the drag goes back over the one before, and reports nothing for one cell', () => {
        const { gestures, drags } = setUp();
        dragThrough(gestures, [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [1.5, 0.5], [1.5, 1.5]]);
        dragThrough(gestures, [[0.5, 0.5], [1.5, 0.5], [0.5, 0.5]]);
        expect(drags).toEqual([[0, 1, 7]]);
    });
});

function setUp() {
    const taps: number[] = [];
    const drags: number[][] = [];
    const gestures = createBoardGesturesViewModel({ size: 6, onTapped: (cell) => taps.push(cell), onDragged: (cells) => drags.push([...cells]) });
    return { gestures, taps, drags };
}

function dragThrough(gestures: ReturnType<typeof createBoardGesturesViewModel>, points: readonly (readonly [number, number])[]): void {
    gestures.press(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) gestures.move(points[i][0], points[i][1]);
    gestures.release();
}
