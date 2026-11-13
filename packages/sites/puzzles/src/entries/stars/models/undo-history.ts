// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The actions a puzzle can take back, newest last, each as the cells it
 * changed were before it. An action is made in three parts: `start`, then
 * `keepCell` for each cell it is about to change, then `finish`.
 */
export interface UndoHistory {
    /** How many actions can be taken back. */
    readonly count: number;
    /** Starts an action. */
    start: () => void;
    /** Keeps `cell`'s mark as it is, before the action changes it, the first time the action touches it. */
    keepCell: (cell: number) => void;
    /** Finishes the action, and keeps it, if it changed anything. Returns whether it did. */
    finish: () => boolean;
    /** Takes back the last action, putting its cells' marks back as they were. Returns the cells it put back, or undefined if there was nothing to take back. */
    undo: () => readonly number[] | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UndoHistoryOptions {
    /** The marks on the puzzle's cells, which actions change, and undo puts back. */
    readonly marks: Uint8Array;
    /** The most actions kept. The oldest goes as another comes. */
    readonly mostUndos: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a history with nothing to take back. */
export function createUndoHistory(options: UndoHistoryOptions): UndoHistory {
    const { marks, mostUndos } = options;
    const actions: Action[] = [];
    // The action being made: the cells it changes, and their marks before it
    let cells: number[] = [];
    let cellMarks: number[] = [];

    return {
        get count() { return actions.length; },
        start() {
            cells = [];
            cellMarks = [];
        },
        keepCell(cell) {
            if (cells.includes(cell)) return;
            cells.push(cell);
            cellMarks.push(marks[cell]);
        },
        finish() {
            // A cell marked and then put back within the action leaves nothing to undo
            const changed: number[] = [];
            const before: number[] = [];
            for (let i = 0; i < cells.length; i++) {
                if (marks[cells[i]] === cellMarks[i]) continue;
                changed.push(cells[i]);
                before.push(cellMarks[i]);
            }
            cells = [];
            cellMarks = [];
            if (changed.length === 0) return false;
            actions.push({ cells: changed, marks: before });
            if (actions.length > mostUndos) actions.shift();
            return true;
        },
        undo() {
            const action = actions.pop();
            if (action === undefined) return undefined;
            for (let i = 0; i < action.cells.length; i++) marks[action.cells[i]] = action.marks[i];
            return action.cells;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Action {
    readonly cells: readonly number[];
    readonly marks: readonly number[];
}
