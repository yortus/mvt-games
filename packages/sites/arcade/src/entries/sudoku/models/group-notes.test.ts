import { describe, expect, it } from 'vitest';
import { toDigitSet } from '#sudoku-digger';
import { type GroupNote, shrinkGroupNotes, toggleGroupNote } from './group-notes';

// Cells are numbered row by row, so cells 0, 1 and 2 are the first three of the top row.

describe('the group notes', () => {
    it('makes a note for cells that have none, and adds a digit to theirs, as new lists', () => {
        const none: readonly GroupNote[] = [];
        const one = toggleGroupNote(none, [0, 1], 2, 7);
        expect(one).toEqual([{ id: 7, cells: [0, 1], digits: toDigitSet(2) }]);
        const two = toggleGroupNote(one, [0, 1], 8, 8);
        expect(two).toEqual([{ id: 7, cells: [0, 1], digits: toDigitSet(2) | toDigitSet(8) }]);
        expect(none).toEqual([]);
        expect(one[0].digits).toBe(toDigitSet(2));
    });

    it('takes away a note as its last digit is taken out', () => {
        const notes = toggleGroupNote([], [0, 1], 2, 1);
        expect(toggleGroupNote(notes, [0, 1], 2, 2)).toEqual([]);
    });

    it('takes a filled cell, and its digit, out of the notes that hold it, leaving the others as they are', () => {
        const other: GroupNote = { id: 2, cells: [40, 41], digits: toDigitSet(5) };
        const notes: GroupNote[] = [{ id: 1, cells: [0, 1, 2], digits: toDigitSet(3) | toDigitSet(4) }, other];
        const shrunk = shrinkGroupNotes(notes, 0, 3, () => undefined);
        expect(shrunk).toEqual([{ id: 1, cells: [1, 2], digits: toDigitSet(4) }, other]);
        expect(shrunk[1]).toBe(other);
    });

    it('hands back the digits of a note left with one cell, for pencil marks there', () => {
        const leftOver: [number, number][] = [];
        const notes: GroupNote[] = [{ id: 1, cells: [0, 1], digits: toDigitSet(3) | toDigitSet(4) }];
        expect(shrinkGroupNotes(notes, 0, 3, (cell, digits) => leftOver.push([cell, digits]))).toEqual([]);
        expect(leftOver).toEqual([[1, toDigitSet(4)]]);
    });

    it('returns the same list when no note holds the cell filled', () => {
        const notes: GroupNote[] = [{ id: 1, cells: [0, 1], digits: toDigitSet(3) }];
        expect(shrinkGroupNotes(notes, 50, 3, () => undefined)).toBe(notes);
    });
});
