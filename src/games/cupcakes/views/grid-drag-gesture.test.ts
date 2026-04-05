import { describe, it, expect } from 'vitest';
import { createGridDragGesture } from './grid-drag-gesture';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CELL = 10;
const COLS = 5;
const ROWS = 5;

/** Simple grid resolver: divides by CELL, returns undefined if out of bounds. */
function simpleResolver(x: number, y: number): { col: number; row: number } | undefined {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
    return { col, row };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridDragGesture', () => {
    it('starts inactive with sentinel values', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        expect(gesture.isActive).toBe(false);
        expect(gesture.origin.col).toBe(-1);
        expect(gesture.origin.row).toBe(-1);
        expect(gesture.target.col).toBe(-1);
        expect(gesture.target.row).toBe(-1);
    });

    it('begin activates and sets origin and pointer', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(35, 28); // col=3, row=2
        expect(gesture.isActive).toBe(true);
        expect(gesture.origin.col).toBe(3);
        expect(gesture.origin.row).toBe(2);
        expect(gesture.pointer.x).toBe(35);
        expect(gesture.pointer.y).toBe(28);
        expect(gesture.target.row).toBe(-1);
    });

    it('begin is a no-op when callback returns undefined', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(-5, 10); // out of bounds
        expect(gesture.isActive).toBe(false);
        expect(gesture.origin.col).toBe(-1);
    });

    it('move updates pointer and target via callback', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(35, 28); // col=3, row=2
        gesture.move(45, 28); // col=4, row=2
        expect(gesture.pointer.x).toBe(45);
        expect(gesture.pointer.y).toBe(28);
        expect(gesture.target.col).toBe(4);
        expect(gesture.target.row).toBe(2);
    });

    it('move sets target to sentinel when callback returns undefined', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(35, 28);
        gesture.move(45, 28);
        gesture.move(-5, 28); // out of bounds
        expect(gesture.target.col).toBe(-1);
        expect(gesture.target.row).toBe(-1);
    });

    it('end deactivates and clears target', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(35, 28);
        gesture.move(45, 28);
        gesture.end();
        expect(gesture.isActive).toBe(false);
        expect(gesture.target.row).toBe(-1);
        expect(gesture.target.col).toBe(-1);
    });

    it('preserves origin after end', () => {
        const gesture = createGridDragGesture({ toGridPosition: simpleResolver });
        gesture.begin(35, 28);
        gesture.end();
        expect(gesture.origin.col).toBe(3);
        expect(gesture.origin.row).toBe(2);
    });

    it('callback can use gesture state for context-dependent resolution', () => {
        // Simulate adjacency filtering: during move, only accept cells adjacent to origin
        const gesture = createGridDragGesture({
            toGridPosition: (x, y) => {
                const col = Math.floor(x / CELL);
                const row = Math.floor(y / CELL);
                if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
                if (gesture.isActive) {
                    const dr = Math.abs(row - gesture.origin.row);
                    const dc = Math.abs(col - gesture.origin.col);
                    if (dr + dc !== 1) return undefined;
                }
                return { col, row };
            },
        });
        gesture.begin(25, 25); // col=2, row=2
        gesture.move(35, 25);  // col=3, row=2 - adjacent, accepted
        expect(gesture.target.col).toBe(3);
        gesture.move(45, 25);  // col=4, row=2 - not adjacent, rejected
        expect(gesture.target.col).toBe(-1);
    });
});
