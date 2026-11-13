import type { CellMark } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a drag over the grid does to the cells it goes over. Where it starts
 * says what it does: a drag that starts on a dot rubs dots out, and any
 * other puts dots in the empty cells it goes over. Stars are left alone
 * either way, so a drag round a star never moves it.
 */
export interface StrokeViewModel {
    /** A drag started at `cell`. */
    start: (cell: number) => void;
    /** The drag went over `cell`. */
    markOver: (cell: number) => void;
    /** The drag finished. */
    finish: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StrokeViewModelOptions {
    readonly markAt: (cell: number) => CellMark;
    readonly onStrokeStarted: () => void;
    readonly onCellMarked: (cell: number, mark: CellMark) => void;
    readonly onStrokeFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the strokes, with none being made. */
export function createStrokeViewModel(options: StrokeViewModelOptions): StrokeViewModel {
    const { markAt, onStrokeStarted, onCellMarked, onStrokeFinished } = options;
    let isRubbingOut = false;
    return {
        start(cell) {
            isRubbingOut = markAt(cell) === 'dot';
            onStrokeStarted();
        },
        markOver(cell) {
            const mark = markAt(cell);
            if (isRubbingOut && mark === 'dot') onCellMarked(cell, 'none');
            else if (!isRubbingOut && mark === 'none') onCellMarked(cell, 'dot');
        },
        finish: onStrokeFinished,
    };
}
