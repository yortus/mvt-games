import { describe, it, expect } from 'vitest';
import type { CupcakeKind } from './common';
import {
    findMatches,
    wouldMatchAt,
    fillGridNoMatches,
    compactColumns,
    countEmptyTop,
} from './grid-helpers';

// Shorthand for grid construction
const S: CupcakeKind = 'strawberry';
const C: CupcakeKind = 'chocolate';
const V: CupcakeKind = 'vanilla';
const B: CupcakeKind = 'blueberry';
const _ = undefined;

describe('findMatches', () => {
    it('returns empty when no 3-in-a-row exists', () => {
        // 3x3 grid, no runs of 3
        const grid = [S, C, V, C, V, S, V, S, C];
        expect(findMatches(grid, 3, 3)).toEqual([]);
    });

    it('finds a horizontal match of 3', () => {
        // 3x3 grid, top row is all strawberry
        const grid = [S, S, S, C, V, B, V, C, B];
        expect(findMatches(grid, 3, 3)).toEqual([0, 1, 2]);
    });

    it('finds a vertical match of 3', () => {
        // 3x3 grid, left column is all chocolate
        const grid = [C, S, V, C, V, S, C, S, V];
        expect(findMatches(grid, 3, 3)).toEqual([0, 3, 6]);
    });

    it('finds a match of 4+', () => {
        // 4x3 grid, left column is 4 strawberry
        const grid = [S, C, V, S, V, C, S, C, V, S, V, C];
        const matches = findMatches(grid, 4, 3);
        expect(matches).toEqual([0, 3, 6, 9]);
    });

    it('finds overlapping horizontal and vertical matches', () => {
        // 3x3 grid:
        // S S S
        // S C V
        // S V C
        const grid = [S, S, S, S, C, V, S, V, C];
        const matches = findMatches(grid, 3, 3);
        // Top row (0,1,2) + left column (0,3,6), deduplicated
        expect(matches).toEqual([0, 1, 2, 3, 6]);
    });

    it('ignores undefined cells', () => {
        const grid = [_, _, _, S, C, V, C, V, S];
        expect(findMatches(grid, 3, 3)).toEqual([]);
    });
});

describe('wouldMatchAt', () => {
    it('detects a horizontal match from two to the left', () => {
        // Row: [S, S, ?] - placing S at col 2 would match
        const grid = [S, S, _];
        expect(wouldMatchAt(grid, 3, 0, 2, S)).toBe(true);
    });

    it('detects a vertical match from two above', () => {
        // Column: [S, S, ?] in a 3x1 grid
        const grid: (CupcakeKind | undefined)[] = [S, S, _];
        expect(wouldMatchAt(grid, 1, 2, 0, S)).toBe(true);
    });

    it('returns false when no match would form', () => {
        const grid = [S, C, _];
        expect(wouldMatchAt(grid, 3, 0, 2, S)).toBe(false);
    });

    it('returns false for positions near the edge', () => {
        const grid = [S, _];
        // col=1 with only one to the left - can not form 3
        expect(wouldMatchAt(grid, 2, 0, 1, S)).toBe(false);
    });
});

describe('fillGridNoMatches', () => {
    it('fills every cell', () => {
        const grid: (CupcakeKind | undefined)[] = new Array(16).fill(undefined);
        let i = 0;
        const kinds: CupcakeKind[] = ['strawberry', 'chocolate', 'vanilla', 'blueberry'];
        fillGridNoMatches(grid, 4, 4, () => kinds[i++ % kinds.length]);
        expect(grid.every((k) => k !== undefined)).toBe(true);
    });

    it('produces no matches', () => {
        const grid: (CupcakeKind | undefined)[] = new Array(25).fill(undefined);
        let i = 0;
        const kinds: CupcakeKind[] = ['strawberry', 'chocolate', 'vanilla', 'blueberry', 'mint', 'lemon'];
        fillGridNoMatches(grid, 5, 5, () => kinds[i++ % kinds.length]);
        expect(findMatches(grid, 5, 5)).toEqual([]);
    });
});

describe('compactColumns', () => {
    it('does nothing when there are no gaps', () => {
        const grid = [S, C, V, C];
        const { didMove } = compactColumns(grid, 2, 2);
        expect(didMove).toBe(false);
        expect(grid).toEqual([S, C, V, C]);
    });

    it('shifts cells down to fill gaps', () => {
        // 3x1 column: [S, _, C] -> [_, S, C]  wait no, compact shifts down
        // Actually: [S, _, C] means row0=S, row1=_, row2=C
        // After compaction row0=_, row1=S, row2=C
        const grid: (CupcakeKind | undefined)[] = [S, _, C];
        const { didMove, sourceRows } = compactColumns(grid, 3, 1);
        expect(didMove).toBe(true);
        expect(grid).toEqual([_, S, C]);
        // S moved from row 0 to row 1
        expect(sourceRows[1]).toBe(0);
    });

    it('compacts multiple gaps in one column', () => {
        // 4x1: [S, _, _, C] -> [_, _, S, C]
        const grid: (CupcakeKind | undefined)[] = [S, _, _, C];
        const { didMove } = compactColumns(grid, 4, 1);
        expect(didMove).toBe(true);
        expect(grid).toEqual([_, _, S, C]);
    });

    it('compacts independently per column', () => {
        // 3x2 grid:
        // col0: [S, _, C]  col1: [_, V, _]
        // Flat: [S, _, _, V, C, _]
        const grid: (CupcakeKind | undefined)[] = [S, _, _, V, C, _];
        compactColumns(grid, 3, 2);
        // col0: [_, S, C]  col1: [_, _, V]
        // Flat: [_, _, S, _, C, V]
        expect(grid).toEqual([_, _, S, _, C, V]);
    });
});

describe('countEmptyTop', () => {
    it('returns 0 for full columns', () => {
        const grid = [S, C, V, C];
        expect(countEmptyTop(grid, 2, 2)).toEqual([0, 0]);
    });

    it('counts contiguous empty cells from the top', () => {
        // 3x2: col0 = [_, _, S], col1 = [_, C, V]
        const grid: (CupcakeKind | undefined)[] = [_, _, _, C, S, V];
        expect(countEmptyTop(grid, 3, 2)).toEqual([2, 1]);
    });

    it('stops counting at first filled cell', () => {
        // 3x1: [_, S, _] - only 1 empty at top (stops at S)
        const grid: (CupcakeKind | undefined)[] = [_, S, _];
        expect(countEmptyTop(grid, 3, 1)).toEqual([1]);
    });
});
