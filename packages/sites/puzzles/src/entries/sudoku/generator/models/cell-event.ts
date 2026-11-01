// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Something that happens to a cell again and again, such as a seed going in
 * or a cell being dug out: how many times it has happened to this puzzle,
 * and the cell and the digit of the last time. A view plays a sound or a
 * flash as the count rises, and reads the cell and the digit to know where
 * and which. The model keeps one record for each, and changes it in place,
 * so reading it allocates nothing.
 */
export interface CellEvent {
    readonly count: number;
    /** The cell of the last time, or -1 before the first. */
    readonly cell: number;
    /** The digit of the last time, or 0 before the first. */
    readonly digit: number;
}

/** A `CellEvent` as the model that keeps it sees it: it can record another time, and start again for a new puzzle. */
export interface CellEventLog extends CellEvent {
    /** Counts one more time, at `cell`, with `digit`. */
    record: (cell: number, digit: number) => void;
    /** Goes back to no times at all, at no cell, with no digit. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a log of something that hasn't happened yet. */
export function createCellEventLog(): CellEventLog {
    let count = 0;
    let cell = -1;
    let digit = 0;
    return {
        get count() { return count; },
        get cell() { return cell; },
        get digit() { return digit; },
        record(at, withDigit) {
            count++;
            cell = at;
            digit = withDigit;
        },
        reset() {
            count = 0;
            cell = -1;
            digit = 0;
        },
    };
}
