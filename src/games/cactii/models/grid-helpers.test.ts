import { describe, it, expect } from 'vitest';
import type { DeepReadonly } from '#common';
import type { CactusCell, CactusKind } from './common';
import { EMPTY_CELL, createCell } from './common';
import {
    findMatches,
    wouldMatchAt,
    fillCellsNoMatches,
    compactColumns,
    countEmptyTop,
    hasAvailableMove,
} from './grid-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a 2D cells grid from a shorthand grid of kinds (undefined = EMPTY_CELL). */
function grid(colCount: number, ...kinds: (CactusKind | undefined)[]): CactusCell[][] {
    const rowCount = Math.ceil(kinds.length / colCount);
    const result: CactusCell[][] = [];
    for (let r = 0; r < rowCount; r++) {
        result[r] = [];
        for (let c = 0; c < colCount; c++) {
            const k = kinds[r * colCount + c];
            result[r][c] = k === undefined ? EMPTY_CELL : createCell(k, r, c);
        }
    }
    return result;
}

/** Extract kinds from 2D cells, flattened row-major for concise assertions. */
function kinds(cells: DeepReadonly<CactusCell[][]>): (CactusKind | undefined)[] {
    const result: (CactusKind | undefined)[] = [];
    for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
            result.push(cells[r][c] === EMPTY_CELL ? undefined : cells[r][c].kind);
        }
    }
    return result;
}

// Shorthand kind constants
const S: CactusKind = 'astrophytum';
const C: CactusKind = 'cereus';
const G: CactusKind = 'euphorbia';
const B: CactusKind = 'ferocactus';
const _ = undefined;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findMatches', () => {
    it('returns empty when no 3-in-a-row exists', () => {
        const cells = grid(3, S, C, G, C, G, S, G, S, C);
        expect(findMatches(cells, 3, 3)).toEqual([]);
    });

    it('finds a horizontal match of 3', () => {
        const cells = grid(3, S, S, S, C, G, B, G, C, B);
        const matched = findMatches(cells, 3, 3);
        expect(matched).toEqual([cells[0][0], cells[0][1], cells[0][2]]);
    });

    it('finds a vertical match of 3', () => {
        const cells = grid(3, C, S, G, C, G, S, C, S, G);
        const matched = findMatches(cells, 3, 3);
        expect(matched).toEqual([cells[0][0], cells[1][0], cells[2][0]]);
    });

    it('finds a match of 4+', () => {
        const cells = grid(3, S, C, G, S, G, C, S, C, G, S, G, C);
        const matched = findMatches(cells, 4, 3);
        expect(matched).toEqual([cells[0][0], cells[1][0], cells[2][0], cells[3][0]]);
    });

    it('finds overlapping horizontal and vertical matches', () => {
        // S S S
        // S C G
        // S G C
        const cells = grid(3, S, S, S, S, C, G, S, G, C);
        const matched = findMatches(cells, 3, 3);
        expect(matched).toEqual([cells[0][0], cells[0][1], cells[0][2], cells[1][0], cells[2][0]]);
    });

    it('ignores empty cells', () => {
        const cells = grid(3, _, _, _, S, C, G, C, G, S);
        expect(findMatches(cells, 3, 3)).toEqual([]);
    });
});

describe('wouldMatchAt', () => {
    it('detects a horizontal match from two to the left', () => {
        const cells = grid(3, S, S, _);
        expect(wouldMatchAt(cells, 0, 2, S)).toBe(true);
    });

    it('detects a vertical match from two above', () => {
        const cells = grid(1, S, S, _);
        expect(wouldMatchAt(cells, 2, 0, S)).toBe(true);
    });

    it('returns false when no match would form', () => {
        const cells = grid(3, S, C, _);
        expect(wouldMatchAt(cells, 0, 2, S)).toBe(false);
    });

    it('returns false for positions near the edge', () => {
        const cells = grid(2, S, _);
        expect(wouldMatchAt(cells, 0, 1, S)).toBe(false);
    });
});

describe('fillCellsNoMatches', () => {
    it('fills every cell', () => {
        const cells: CactusCell[][] = [];
        for (let r = 0; r < 4; r++) cells[r] = new Array(4).fill(EMPTY_CELL);
        let i = 0;
        const allKinds: CactusKind[] = ['astrophytum', 'cereus', 'euphorbia', 'ferocactus'];
        fillCellsNoMatches(cells, 4, 4, () => allKinds[i++ % allKinds.length]);
        for (let r = 0; r < cells.length; r++) {
            expect(cells[r].every((c) => c !== EMPTY_CELL)).toBe(true);
        }
    });

    it('produces no matches', () => {
        const cells: CactusCell[][] = [];
        for (let r = 0; r < 5; r++) cells[r] = new Array(5).fill(EMPTY_CELL);
        let i = 0;
        const allKinds: CactusKind[] = ['astrophytum', 'cereus', 'euphorbia', 'ferocactus', 'opuntia', 'rebutia'];
        fillCellsNoMatches(cells, 5, 5, () => allKinds[i++ % allKinds.length]);
        expect(findMatches(cells, 5, 5)).toEqual([]);
    });
});

describe('compactColumns', () => {
    it('does nothing when there are no gaps', () => {
        const cells = grid(2, S, C, G, C);
        const { didMove } = compactColumns(cells, 2, 2);
        expect(didMove).toBe(false);
        expect(kinds(cells)).toEqual([S, C, G, C]);
    });

    it('shifts cells down to fill gaps', () => {
        // 3x1 column: [S, _, C] -> [_, S, C]
        const cells = grid(1, S, _, C);
        const { didMove, sourceRows } = compactColumns(cells, 3, 1);
        expect(didMove).toBe(true);
        expect(kinds(cells)).toEqual([_, S, C]);
        expect(sourceRows[1][0]).toBe(0);
    });

    it('compacts multiple gaps in one column', () => {
        // 4x1: [S, _, _, C] -> [_, _, S, C]
        const cells = grid(1, S, _, _, C);
        const { didMove } = compactColumns(cells, 4, 1);
        expect(didMove).toBe(true);
        expect(kinds(cells)).toEqual([_, _, S, C]);
    });

    it('compacts independently per column', () => {
        // 3x2 grid:
        // col0: [S, _, C]  col1: [_, G, _]
        // Flat: [S, _, _, G, C, _]
        const cells = grid(2, S, _, _, G, C, _);
        compactColumns(cells, 3, 2);
        // col0: [_, S, C]  col1: [_, _, G]
        expect(kinds(cells)).toEqual([_, _, S, _, C, G]);
    });
});

describe('countEmptyTop', () => {
    it('returns 0 for full columns', () => {
        const cells = grid(2, S, C, G, C);
        expect(countEmptyTop(cells, 2, 2)).toEqual([0, 0]);
    });

    it('counts contiguous empty cells from the top', () => {
        // 3x2: col0 = [_, _, S], col1 = [_, C, G]
        const cells = grid(2, _, _, _, C, S, G);
        expect(countEmptyTop(cells, 3, 2)).toEqual([2, 1]);
    });

    it('stops counting at first filled cell', () => {
        // 3x1: [_, S, _] - only 1 empty at top
        const cells = grid(1, _, S, _);
        expect(countEmptyTop(cells, 3, 1)).toEqual([1]);
    });
});

describe('hasAvailableMove', () => {
    it('returns true when a horizontal swap creates a match', () => {
        // Swapping (0,1) C <-> (0,2) S gives S S S in row 0
        const cells = grid(3,
            S, C, S,
            C, S, C,
            S, C, S,
        );
        expect(hasAvailableMove(cells, 3, 3)).toBe(true);
    });

    it('returns true when a vertical swap creates a match', () => {
        // Swapping (1,0) C <-> (2,0) S gives col0 = S,S,S
        const cells = grid(3,
            S, C, G,
            C, G, C,
            S, C, G,
        );
        expect(hasAvailableMove(cells, 3, 3)).toBe(true);
    });

    it('returns false when no swap creates a match', () => {
        // 3-color Latin square: no swap can produce a run of 3
        const cells = grid(3,
            S, C, G,
            C, G, S,
            G, S, C,
        );
        expect(hasAvailableMove(cells, 3, 3)).toBe(false);
    });

    it('returns false for a larger deadlocked board', () => {
        // 4x4 Latin square with 4 colors
        const cells = grid(4,
            S, C, G, B,
            C, G, B, S,
            G, B, S, C,
            B, S, C, G,
        );
        expect(hasAvailableMove(cells, 4, 4)).toBe(false);
    });

    it('ignores empty cells', () => {
        const cells = grid(3,
            _, _, _,
            _, _, _,
            _, _, _,
        );
        expect(hasAvailableMove(cells, 3, 3)).toBe(false);
    });

    it('detects a move when swapped cell creates a match in the other position', () => {
        // Row 0: S C S  -- swapping C→S at (0,1)↔(1,1) puts S at (0,1), making S S S
        // Row 1: G S G
        // Row 2: C G C
        const cells = grid(3,
            S, G, S,
            C, S, C,
            G, C, G,
        );
        expect(hasAvailableMove(cells, 3, 3)).toBe(true);
    });
});
