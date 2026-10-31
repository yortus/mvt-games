import { describe, expect, it } from 'vitest';
import type { GroupNote } from '../models';
import { findGroupNoteLanes } from './find-group-note-lanes';

// Cells are numbered row by row, so cell 1 is beside cell 0, and cell 9 below it.

describe('findGroupNoteLanes', () => {
    it('gives notes that share a cell lanes of their own, and notes apart the first lane', () => {
        const notes = [toNote([0, 1]), toNote([0, 9]), toNote([30, 31]), toNote([1, 2]), toNote([0, 2])];
        expect(findGroupNoteLanes(notes)).toEqual([0, 1, 0, 1, 2]);
    });
});

function toNote(cells: number[]): GroupNote {
    return { id: cells[0], cells, digits: 0b110 };
}
