import { createGridGesturesViewModel, type GridGesturesViewModel } from '@mvtjs/site-kit/input';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    /** How many cells along each side of the grid. */
    readonly size: number;
    /** The player tapped `cell`. */
    readonly onTapped: (cell: number) => void;
    /** The player started a drag at `cell`. Every cell it goes over, this one first, is reported next. */
    readonly onDragStarted: (cell: number) => void;
    /** The player dragged over `cell`. */
    readonly onDraggedOver: (cell: number) => void;
    /** The player let go, or the drag was cancelled. */
    readonly onDragFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the taps and drags on the grid, as the cells they land on and go
 * over. A drag steps from cell to cell, diagonally too, so a drag round a
 * star follows its ring of neighbours. It reports only the cells. What a
 * tap or a drag does to them is up to whoever it reports to. Positions are
 * in cells, across and down from the grid's top left corner.
 */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): GridGesturesViewModel {
    const { size, onTapped, onDragStarted, onDraggedOver, onDragFinished } = options;
    let isDragging = false;
    return createGridGesturesViewModel({
        rows: size,
        cols: size,
        lattice: 'cells',
        steps: 'eight-way',
        cellReach: CELL_REACH,
        onTapped,
        onStepped(from, to) {
            if (!isDragging) {
                isDragging = true;
                onDragStarted(from);
                onDraggedOver(from);
            }
            onDraggedOver(to);
        },
        onDragFinished: finishDrag,
        onDragCancelled: finishDrag,
    });

    function finishDrag(): void {
        isDragging = false;
        onDragFinished();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to step into it, in cells, across and down, so a wobbly tap stays a tap. */
const CELL_REACH = 0.4;
