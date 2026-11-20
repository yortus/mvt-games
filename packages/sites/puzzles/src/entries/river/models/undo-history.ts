// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The states a puzzle can go back to, newest last, each as it was before an
 * action. A valley is small, so a whole copy of its marks for each
 * action costs little, and undo is then only putting a copy back.
 */
export interface UndoHistory<T> {
    /** How many actions can be taken back. */
    readonly count: number;
    /** Keeps `before`, the state as it is before an action. */
    keep: (before: T) => void;
    /** Returns the state before the last action, and forgets it, or undefined if there is nothing to take back. */
    takeBack: () => T | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What an undo history is created with. */
export interface UndoHistoryOptions {
    /** The most actions kept. The oldest goes as another comes. */
    readonly mostUndos: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a history with nothing to take back. */
export function createUndoHistory<T>(options: UndoHistoryOptions): UndoHistory<T> {
    const { mostUndos } = options;
    const states: T[] = [];
    return {
        get count() { return states.length; },
        keep(before) {
            states.push(before);
            if (states.length > mostUndos) states.shift();
        },
        takeBack: () => states.pop(),
    };
}
