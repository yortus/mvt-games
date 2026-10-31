import { describe, expect, it } from 'vitest';
import { findGroupNoteLines, layOutGroupNotes, placeGroupNote } from './group-note-layout';

const isFilledAt = (): boolean => false;

describe('findGroupNoteLines', () => {
    it('joins three cells in an L as an L, through its corner, whatever their order', () => {
        // The top left cell, the one to its right, and the one below that
        const lines = findGroupNoteLines([0, 1, 10], 0);
        expect(lines).toEqual([
            { fromX: 0.5, fromY: 0.5, toX: 1.5, toY: 0.5 },
            { fromX: 1.5, fromY: 0.5, toX: 1.5, toY: 1.5 },
        ]);
        // The corner is the top left cell, which comes between the others in the path, not first
        const corner = findGroupNoteLines([0, 1, 9], 0);
        expect(corner).toHaveLength(2);
        expect([corner[0].toX, corner[0].toY]).toEqual([0.5, 0.5]);
    });

    it('meets at the corner of an L in a higher lane too, where the lines shifted to one side cross', () => {
        const [across, down] = findGroupNoteLines([0, 1, 10], 1);
        expect(across.toX).toBeCloseTo(down.fromX);
        expect(across.toY).toBeCloseTo(down.fromY);
        expect(across.toY).not.toBeCloseTo(0.5);
        expect(down.fromX).not.toBeCloseTo(1.5);
    });
});

describe('placeGroupNote', () => {
    it('puts the label on the corner of an L', () => {
        expect(placeGroupNote({ cells: [0, 1, 10], lane: 0, digits: 0b110, isFilledAt })).toEqual({ x: 1.5, y: 0.5 });
    });

    it('puts the label on the edge two neighbours share', () => {
        expect(placeGroupNote({ cells: [0, 1], lane: 0, digits: 0b110, isFilledAt })).toEqual({ x: 1, y: 0.5 });
    });
});

describe('layOutGroupNotes', () => {
    it('lays each note out as findGroupNoteLines and placeGroupNote do, with notes that share a cell in lanes of their own', () => {
        const notes = [{ id: 1, cells: [0, 1], digits: 0b110 }, { id: 2, cells: [1, 2], digits: 0b1100 }];
        const [first, second] = layOutGroupNotes(notes, isFilledAt);
        expect(first.note).toBe(notes[0]);
        expect(first.lines).toEqual(findGroupNoteLines([0, 1], 0));
        expect(second.lines).toEqual(findGroupNoteLines([1, 2], 1));
        expect({ x: second.labelX, y: second.labelY }).toEqual(placeGroupNote({ cells: [1, 2], lane: 1, digits: 0b1100, isFilledAt }));
    });
});
