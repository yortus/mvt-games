import { HIGHEST_NOTE_NAME, isNoteInRange, toNoteNumber } from './notes';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The note number of a token such as `C-4`, or undefined if it is not a
 * note. Throws an error that starts with `where` if it is a note above the
 * highest.
 */
export function parseNoteToken(token: string, where: string): number | undefined {
    const note = toNoteNumber(token);
    if (note !== undefined && !isNoteInRange(note)) throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
    return note;
}
