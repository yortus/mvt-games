import { describe, expect, it } from 'vitest';
import { createSwapGesturesViewModel } from './swap-gestures-view-model';

// A row of tiles one tile edge wide, tile n from n to n + 1 across. Tile 2 is locked, and tile 5 is another shape.
const tileAt = (x: number): number => (x >= 0 && x < 6 ? Math.floor(x) : -1);
const isLockedAt = (tile: number): boolean => tile === 2;
const canSwap = (a: number, b: number): boolean => a !== b && !isLockedAt(a) && !isLockedAt(b) && (a === 5) === (b === 5);

function setUp() {
    const swaps: [number, number][] = [];
    const gestures = createSwapGesturesViewModel({ tileAt, isLockedAt, canSwap, onSwapRequested: (a, b) => swaps.push([a, b]) });
    return { gestures, swaps };
}

describe('swap gestures', () => {
    it('swaps a piece dragged onto another', () => {
        const { gestures, swaps } = setUp();
        gestures.press(0.5, 0);
        gestures.move(3.5, 0);
        expect(gestures.draggedTile).toBe(0);
        expect(gestures.targetTile).toBe(3);
        gestures.release();
        expect(swaps).toEqual([[0, 3]]);
        expect(gestures.draggedTile).toBe(-1);
        expect([gestures.dragsEnded, gestures.endedTile, gestures.endedX]).toEqual([1, 0, 3.5]);
    });

    it('swaps nothing for a drag let go over a locked tile, another shape, off the picture, or where it started', () => {
        const { gestures, swaps } = setUp();
        for (const x of [2.5, 5.5, 9, 0.9]) {
            gestures.press(0.1, 0);
            gestures.move(x, 0);
            gestures.release();
        }
        expect(swaps).toEqual([]);
        expect(gestures.dragsEnded).toBe(4);
    });

    it('swaps two pieces tapped in turn, and puts a piece down tapped again', () => {
        const { gestures, swaps } = setUp();
        gestures.press(1.5, 0);
        gestures.release();
        expect(gestures.pickedTile).toBe(1);
        gestures.press(1.5, 0);
        gestures.release();
        expect(gestures.pickedTile).toBe(-1);
        gestures.press(1.5, 0);
        gestures.release();
        gestures.press(4.5, 0);
        gestures.release();
        expect(swaps).toEqual([[1, 4]]);
        expect(gestures.pickedTile).toBe(-1);
    });

    it('picks up a piece of another shape tapped instead of swapping with it', () => {
        const { gestures, swaps } = setUp();
        gestures.press(1.5, 0);
        gestures.release();
        gestures.press(5.5, 0);
        gestures.release();
        expect(swaps).toEqual([]);
        expect(gestures.pickedTile).toBe(5);
    });

    it('never picks up a locked piece, and puts a piece down at a tap off the picture', () => {
        const { gestures } = setUp();
        gestures.press(2.5, 0);
        gestures.release();
        expect(gestures.pickedTile).toBe(-1);
        gestures.press(0.5, 0);
        gestures.release();
        gestures.press(9, 0);
        gestures.release();
        expect(gestures.pickedTile).toBe(-1);
    });

    it('swaps nothing when the pointer is taken away mid drag', () => {
        const { gestures, swaps } = setUp();
        gestures.press(0.5, 0);
        gestures.move(3.5, 0);
        gestures.cancel();
        gestures.release();
        expect(swaps).toEqual([]);
        expect(gestures.draggedTile).toBe(-1);
    });
});
