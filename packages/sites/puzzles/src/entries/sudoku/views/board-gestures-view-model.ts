import { createGridGesturesViewModel, type GridGesturesViewModel } from '@mvtjs/site-kit/input';
import type { GroupNote } from '../models';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    /** The group note whose label is at (`x`, `y`), if one is shown there. */
    readonly labelNoteAt: (x: number, y: number) => GroupNote | undefined;
    /** The player tapped `cell`. */
    readonly onCellTapped: (cell: number) => void;
    /** The player tapped `note`'s label. */
    readonly onNoteLabelTapped: (note: GroupNote) => void;
    /** The player dragged through `cells`, so far, in the order the drag took them in. */
    readonly onCellsDragged: (cells: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the taps and drags on the grid, as the cells they choose. A tap
 * is on a cell, or on a group note's label. A drag takes in every cell it
 * passes through the middle of, one at a time, so it can run past a cell's
 * corner without taking it in, and a fast drag misses no cell.
 *
 * It says only which cells were chosen. What that does to the selection is
 * up to whoever it reports to. Positions are in cells, across and down the
 * grid.
 */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): GridGesturesViewModel {
    const { labelNoteAt, onCellTapped, onNoteLabelTapped, onCellsDragged } = options;
    // The cells the drag being made has taken in
    let draggedCells: number[] = [];

    return createGridGesturesViewModel({
        rows: 9,
        cols: 9,
        lattice: 'cells',
        steps: 'eight-way',
        cellReach: DRAG_REACH,
        onTapped(cell, x, y) {
            const note = labelNoteAt(x, y);
            if (note !== undefined) onNoteLabelTapped(note);
            else onCellTapped(cell);
        },
        onStepped(from, to) {
            if (draggedCells.length === 0) draggedCells.push(from);
            if (draggedCells.includes(to)) return;
            draggedCells.push(to);
            onCellsDragged(draggedCells);
        },
        onDragFinished: forgetDrag,
        onDragCancelled: forgetDrag,
    });

    function forgetDrag(): void {
        draggedCells = [];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to take the cell in, in cells, across and down. */
const DRAG_REACH = 0.38;
