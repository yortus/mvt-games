import type { CellMark } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A stroke is what a drag over the harbour does to the cells it goes over.
 * The cell that the drag begins at decides what it marks. The stroke marks
 * that cell as a tap would, then marks every cell it goes over the same
 * way. So a drag from an empty cell marks water, a drag from water marks a
 * boat, and a drag from a boat clears. A tap can't change a printed cell,
 * so a drag from one marks water. Each stroke is undone as one.
 */
export interface StrokeViewModel {
    /** The drag began at `cell`. */
    start: (cell: number) => void;
    /** The drag went over `cell`. */
    markOver: (cell: number) => void;
    /** The drag ended, so the next begins a stroke of its own. */
    finish: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the strokes are created with. */
export interface StrokeViewModelOptions {
    /** The mark on `cell`, given or the player's. */
    readonly markAt: (cell: number) => CellMark;
    /** Whether `cell` is printed on the harbour. */
    readonly isGivenAt: (cell: number) => boolean;
    /** What a tap turns each mark into. */
    readonly nextMarks: Readonly<Record<CellMark, CellMark>>;
    /** The player began a stroke. */
    readonly onStrokeStarted: () => void;
    /** The stroke went over `cell`, marking it `mark`. */
    readonly onCellMarked: (cell: number, mark: CellMark) => void;
    /** The player finished the stroke. */
    readonly onStrokeFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the strokes, with none being made. */
export function createStrokeViewModel(options: StrokeViewModelOptions): StrokeViewModel {
    const { markAt, isGivenAt, nextMarks, onStrokeStarted, onCellMarked, onStrokeFinished } = options;
    let mark: CellMark = 'water';
    return {
        start(cell) {
            mark = isGivenAt(cell) ? 'water' : nextMarks[markAt(cell)];
            onStrokeStarted();
            onCellMarked(cell, mark);
        },
        markOver: (cell) => onCellMarked(cell, mark),
        finish: onStrokeFinished,
    };
}
