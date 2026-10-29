import { parseNoteToken } from './parse-note-token';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The note number of a name such as `C-4`. If the name is not a note in range, throws an error that starts with `where`. */
export function parseNote(name: string, where: string): number {
    const note = parseNoteToken(name, where);
    if (note === undefined) throw new Error(`${where}: '${name}' is not a note (write C-4, F#5)`);
    return note;
}
