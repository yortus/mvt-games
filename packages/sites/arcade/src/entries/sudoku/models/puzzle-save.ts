import { ALL_DIGITS, CELL_COUNT, isOneUnit } from '#sudoku-digger';

// A puzzle as it stood, kept as plain values for storage, and read back.
// What is read back comes from the visitor's browser, so it is checked
// first: anything that is not a whole save of the puzzle's givens is
// ignored.

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The givens, as 81 digits, row by row, with 0 for each empty cell. */
    readonly givens: string;
    /** The player's answers, the same way, with 0 for each given cell and each cell not filled in. */
    readonly answers: string;
    /** Each cell's pencil marks, as sets of digits. */
    readonly marks: readonly number[];
    /** The group notes, oldest first. */
    readonly groupNotes: readonly SavedGroupNote[];
}

/** A group note as it is kept: its cells, and its digits as a set. */
export interface SavedGroupNote {
    readonly cells: readonly number[];
    readonly digits: number;
}

/** What `writePuzzleSave` saves: the givens, every cell's digit, given or answered, and the notes. */
export interface PuzzleSaving {
    readonly givens: readonly number[];
    readonly digits: Readonly<Uint8Array>;
    readonly marks: Readonly<Uint16Array>;
    readonly groupNotes: readonly SavedGroupNote[];
}

/** Returns the save of a puzzle as it stands. */
export function writePuzzleSave(saving: PuzzleSaving): PuzzleSave {
    const { givens, digits } = saving;
    return {
        givens: givens.join(''),
        answers: Array.from(digits, (digit, cell) => (givens[cell] === 0 ? digit : 0)).join(''),
        marks: Array.from(saving.marks),
        groupNotes: saving.groupNotes.map((note) => ({ cells: note.cells, digits: note.digits })),
    };
}

/**
 * Returns `saved` if it is a whole save of the puzzle with `givens`, or
 * undefined if not: if it is of other givens, isn't shaped as a save is,
 * answers a given cell, or has a group note that holds a filled cell.
 */
export function readPuzzleSave(saved: unknown, givens: readonly number[]): PuzzleSave | undefined {
    if (!isPuzzleSave(saved) || saved.givens !== givens.join('')) return undefined;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (givens[cell] !== 0 && saved.answers[cell] !== '0') return undefined;
    }
    const isFilledAt = (cell: number): boolean => givens[cell] !== 0 || saved.answers[cell] !== '0';
    if (saved.groupNotes.some((note) => note.cells.some(isFilledAt))) return undefined;
    return saved;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isPuzzleSave(value: unknown): value is PuzzleSave {
    if (typeof value !== 'object' || value === null) return false;
    const { givens, answers, marks, groupNotes } = value as Record<string, unknown>;
    return typeof givens === 'string' && typeof answers === 'string' && /^\d{81}$/.test(answers)
        && Array.isArray(marks) && marks.length === CELL_COUNT && marks.every(isDigitSet)
        && Array.isArray(groupNotes) && groupNotes.every(isSavedGroupNote);
}

/** Whether `value` is a set of digits: bits 1 to 9, at most. */
function isDigitSet(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && (value & ~ALL_DIGITS) === 0;
}

function isSavedGroupNote(value: unknown): value is SavedGroupNote {
    if (typeof value !== 'object' || value === null) return false;
    const { cells, digits } = value as Record<string, unknown>;
    return Array.isArray(cells) && cells.length >= 2 && cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT)
        && isOneUnit(cells as number[]) && isDigitSet(digits) && digits !== 0;
}
