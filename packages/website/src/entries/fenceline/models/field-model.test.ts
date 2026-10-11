import { describe, expect, it } from 'vitest';
import { createFieldModel, type FieldModel } from './field-model';

/** Ties a wire through the points given as [row, col] pairs. */
function addWire(field: FieldModel, points: readonly (readonly [number, number])[]): void {
    field.addFence(points.map((p) => p[0]), points.map((p) => p[1]), points.length);
}

/** Every point from (row0, col0) to (row1, col1) along one line, both ends included. */
function line(row0: number, col0: number, row1: number, col1: number): [number, number][] {
    const points: [number, number][] = [];
    const steps = Math.max(Math.abs(row1 - row0), Math.abs(col1 - col0));
    for (let i = 0; i <= steps; i++) {
        points.push([row0 + Math.sign(row1 - row0) * i, col0 + Math.sign(col1 - col0) * i]);
    }
    return points;
}

describe('FieldModel', () => {
    it('starts as one open region, fenced all round', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        expect(field.claimableCount).toBe(80);
        expect(field.claimedCount).toBe(0);
        expect(field.regionAt(0, 0)).toBe(field.regionAt(7, 9));
        expect(field.regionSize(field.regionAt(0, 0))).toBe(80);
        expect(field.isWalkable(0, 0, 'right')).toBe(true);
        expect(field.isWalkable(0, 0, 'down')).toBe(true);
        expect(field.isWalkable(8, 10, 'up')).toBe(true);
        expect(field.isOnFence(0, 5)).toBe(true);
        expect(field.isOnFence(4, 5)).toBe(false);
    });

    it('lets wire be strung into the open meadow, but not along a fence or out of the meadow', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        expect(field.canString(8, 5, 'up')).toBe(true);
        expect(field.canString(8, 5, 'right')).toBe(false);
        expect(field.canString(8, 5, 'down')).toBe(false);
        expect(field.canString(4, 5, 'left')).toBe(true);
    });

    it('fences off the side of a wire that is let go, and keeps the other open', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        // Across the corner: up from the bottom edge at column 3, then left to the left edge
        addWire(field, [...line(8, 3, 5, 3), ...line(5, 2, 5, 0)]);
        expect(field.closureCount).toBe(1);
        const corner = field.regionAt(7, 0);
        const rest = field.regionAt(0, 9);
        expect(corner).not.toBe(rest);
        expect(field.regionSize(corner)).toBe(9);

        const claimed = field.claimRegions((region) => region === rest);
        expect(claimed).toBe(9);
        expect(field.claimedCount).toBe(9);
        expect(field.claimedShare).toBeCloseTo(9 / 80);
        expect(field.cellKindAt(7, 0)).toBe('pasture');
        expect(field.closureAt(7, 0)).toBe(1);
        expect(field.closureAt(0, 9)).toBe(0);
        expect(field.lastClosureCells).toBe(9);
        expect(field.lastClosureRow).toBeCloseTo(6.5);
        expect(field.lastClosureCol).toBeCloseTo(1.5);
    });

    it('leaves behind the fences with pasture on both sides, and walks the new one', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        addWire(field, [...line(8, 3, 5, 3), ...line(5, 2, 5, 0)]);
        const rest = field.regionAt(0, 9);
        field.claimRegions((region) => region === rest);
        // The old edge round the corner has pasture inside and nothing outside
        expect(field.hasFence(8, 0, 'right')).toBe(true);
        expect(field.isWalkable(8, 0, 'right')).toBe(false);
        expect(field.isOnFence(8, 1)).toBe(false);
        // The new fence has meadow on one side
        expect(field.isWalkable(8, 3, 'up')).toBe(true);
        expect(field.isWalkable(5, 0, 'right')).toBe(true);
        // No wire across pasture
        expect(field.canString(6, 1, 'right')).toBe(false);
    });

    it('finds the fence point nearest or farthest, keeping clear of a point when asked', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        expect(field.findFencePoint({ row: 4, col: 1, which: 'nearest' })).toEqual({ row: 4, col: 0 });
        expect(field.findFencePoint({ row: 0, col: 0, which: 'farthest' })).toEqual({ row: 8, col: 10 });
        const clearOf = { row: 4, col: 0, distance: 3 };
        const point = field.findFencePoint({ row: 4, col: 1, which: 'nearest', clearOf });
        expect(point).toBeDefined();
        expect(Math.hypot((point?.row ?? 0) - 4, (point?.col ?? 0) - 0)).toBeGreaterThanOrEqual(3);
    });

    it('finds no fence point, and no way along a fence, once the meadow is all fenced off', () => {
        const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
        expect(field.findWayAlongFence(0, 5)).toBeDefined();
        field.claimRegions(() => false);
        expect(field.findFencePoint({ row: 4, col: 5, which: 'nearest' })).toBeUndefined();
        expect(field.findWayAlongFence(0, 5)).toBeUndefined();
    });

    it('fences round each pond, which counts towards neither side', () => {
        const field = createFieldModel({
            rows: 8,
            cols: 10,
            obstacles: [{ kind: 'pond', row: 4, col: 5, rowRadius: 1, colRadius: 1 }],
        });
        expect(field.cellKindAt(3, 4)).toBe('pond');
        expect(field.claimableCount).toBe(76);
        expect(field.isWalkable(3, 4, 'right')).toBe(true);
        expect(field.isOnFence(3, 4)).toBe(true);
        expect(field.regionAt(3, 4)).toBe(-1);
    });

    it('splits nothing with a wire from the edge to a pond: the meadow still goes round it', () => {
        const field = createFieldModel({
            rows: 8,
            cols: 10,
            obstacles: [{ kind: 'pond', row: 4, col: 5, rowRadius: 1, colRadius: 1 }],
        });
        addWire(field, line(8, 4, 5, 4));
        expect(field.regionSize(field.regionAt(0, 0))).toBe(76);
        expect(field.claimRegions(() => false)).toBe(76);
    });
});
