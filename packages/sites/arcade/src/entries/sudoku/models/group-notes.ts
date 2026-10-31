import { toDigitSet } from '#sudoku-digger';

// The rules of group notes, as functions of a list of notes. A list is never
// changed: each function returns a new one, so a view can tell when the
// notes change, and undo can keep the list as it was.

// ---------------------------------------------------------------------------
// Group notes
// ---------------------------------------------------------------------------

/** Digits that some cells hold between them, in some order: a pair in two cells, a triple in three, and so on. */
export interface GroupNote {
    /** Which note it is, for telling notes apart as others come and go. */
    readonly id: number;
    /** The cells, in order. They share a row, a column or a box. */
    readonly cells: readonly number[];
    /** The digits, as a set: bit `d` is set for each digit `d`. */
    readonly digits: number;
}

/** Returns the note of exactly `cells`, in the same order, if `notes` has one. */
export function findGroupNote(notes: readonly GroupNote[], cells: readonly number[]): GroupNote | undefined {
    return notes.find((note) => note.cells.length === cells.length && note.cells.every((cell, i) => cell === cells[i]));
}

/**
 * Returns `notes` with `digit` noted for `cells`, or taken out of their
 * note if it holds it. A new note takes the id `newId`, and a note left
 * with no digits is gone.
 */
export function toggleGroupNote(notes: readonly GroupNote[], cells: readonly number[], digit: number, newId: number): readonly GroupNote[] {
    const note = findGroupNote(notes, cells);
    if (note === undefined) return [...notes, { id: newId, cells, digits: toDigitSet(digit) }];
    const digits = note.digits ^ toDigitSet(digit);
    if (digits === 0) return notes.filter((each) => each !== note);
    return notes.map((each) => (each === note ? { ...note, digits } : each));
}

/**
 * Returns `notes` with `cell`, just filled with `digit`, taken out of each
 * note that holds it, and the digit too, if the note holds it. A note left
 * with no digits is gone. One left with a single cell is gone too, and
 * `onLeftWithOne` is told its cell and digits, which become pencil marks
 * there. Returns `notes` itself if no note holds the cell.
 */
export function shrinkGroupNotes(
    notes: readonly GroupNote[],
    cell: number,
    digit: number,
    onLeftWithOne: (cell: number, digits: number) => void,
): readonly GroupNote[] {
    if (!notes.some((note) => note.cells.includes(cell))) return notes;
    const kept: GroupNote[] = [];
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (!note.cells.includes(cell)) {
            kept.push(note);
            continue;
        }
        const cells = note.cells.filter((each) => each !== cell);
        const digits = note.digits & ~toDigitSet(digit);
        if (digits === 0) continue;
        if (cells.length > 1) kept.push({ ...note, cells, digits });
        else onLeftWithOne(cells[0], digits);
    }
    return kept;
}
