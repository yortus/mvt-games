import { describe, expect, it } from 'vitest';
import { findSelectionAfterTap } from './find-selection-after-tap';

describe('findSelectionAfterTap', () => {
    it('selects a cell tapped alone, from nothing selected or from other cells', () => {
        expect(findSelectionAfterTap([], 4)).toEqual([4]);
        expect(findSelectionAfterTap([1, 2], 4)).toEqual([4]);
    });

    it('takes a cell tapped out of several selected', () => {
        expect(findSelectionAfterTap([1, 4, 7], 4)).toEqual([1, 7]);
    });

    it('clears the one cell selected when it is tapped again', () => {
        expect(findSelectionAfterTap([4], 4)).toEqual([]);
    });
});
