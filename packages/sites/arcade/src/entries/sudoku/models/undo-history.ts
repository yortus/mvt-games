import type { GroupNote } from './group-notes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The actions a puzzle can take back, newest last, each as the cells it
 * changed were before it, and the group notes before it, if it changed
 * them. An action is made in three parts: `start`, then `keepCell` and
 * `keepGroupNotes` for whatever it is about to change, then `finish`.
 */
export interface UndoHistory {
    /** How many actions can be taken back. */
    readonly count: number;
    /** Starts an action. */
    start: () => void;
    /** Keeps `cell`'s digit and marks as they are, before the action changes them, the first time the action touches it. */
    keepCell: (cell: number) => void;
    /** Keeps `notes`, the group notes as they are, before the action changes them, the first time it does. */
    keepGroupNotes: (notes: readonly GroupNote[]) => void;
    /** Finishes the action, and keeps it, if it changed anything. Returns whether it did. */
    finish: () => boolean;
    /**
     * Takes back the last action: puts its cells' digits and marks back as
     * they were, and returns the group notes as they were before it, or the
     * notes unchanged if it left them alone. Returns undefined if there is
     * no action to take back.
     */
    undo: (notes: readonly GroupNote[]) => readonly GroupNote[] | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UndoHistoryOptions {
    /** The puzzle's digits and marks, which actions change, and undo puts back. */
    readonly digits: Uint8Array;
    readonly marks: Uint16Array;
    /** The most actions kept. The oldest goes as another comes. */
    readonly mostUndos: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a history with nothing to take back. */
export function createUndoHistory(options: UndoHistoryOptions): UndoHistory {
    const { digits, marks, mostUndos } = options;
    const actions: Action[] = [];
    // The action being made: the cells it changes, as they were before it, and the group notes before it, if it changes them
    let cells: number[] = [];
    let cellDigits: number[] = [];
    let cellMarks: number[] = [];
    let groupNotes: readonly GroupNote[] | undefined;

    return {
        get count() { return actions.length; },
        start() {
            cells = [];
            cellDigits = [];
            cellMarks = [];
            groupNotes = undefined;
        },
        keepCell(cell) {
            if (cells.includes(cell)) return;
            cells.push(cell);
            cellDigits.push(digits[cell]);
            cellMarks.push(marks[cell]);
        },
        keepGroupNotes(notes) { groupNotes ??= notes; },
        finish() {
            if (cells.length === 0 && groupNotes === undefined) return false;
            actions.push({ cells, digits: cellDigits, marks: cellMarks, groupNotes });
            if (actions.length > mostUndos) actions.shift();
            return true;
        },
        undo(notes) {
            const action = actions.pop();
            if (action === undefined) return undefined;
            for (let i = 0; i < action.cells.length; i++) {
                digits[action.cells[i]] = action.digits[i];
                marks[action.cells[i]] = action.marks[i];
            }
            return action.groupNotes ?? notes;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Action {
    readonly cells: readonly number[];
    readonly digits: readonly number[];
    readonly marks: readonly number[];
    /** The group notes before it, if it changed them. */
    readonly groupNotes: readonly GroupNote[] | undefined;
}
