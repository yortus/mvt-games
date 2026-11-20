import { createGridGesturesViewModel, type GridGesturesViewModel } from '@mvtjs/site-kit/input';
import type { ValleyGrid } from '../models';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the gestures are created with. */
export interface BoardGesturesViewModelOptions {
    /** The puzzle's valley. */
    readonly grid: ValleyGrid;
    /** The player tapped `cell`. */
    readonly onTapped: (cell: number) => void;
    /** The player dragged across `edge`, from one cell to the next. */
    readonly onDraggedOver: (edge: number) => void;
    /** The player let go, or the drag was cancelled, after dragging across an edge or more. */
    readonly onDragFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the taps and drags on the valley. A tap is reported as the cell
 * it landed on. A drag follows the cells it passes through the middle of,
 * across and down, never diagonally, and each step from a cell to the next
 * is reported as the edge it crosses. The stroke view model decides
 * whether a drag draws the river or rubs it out. Positions are in cells,
 * across and down from the valley's top left corner.
 */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): GridGesturesViewModel {
    const { grid, onTapped, onDraggedOver, onDragFinished } = options;
    return createGridGesturesViewModel({
        rows: grid.size,
        cols: grid.size,
        lattice: 'cells',
        steps: 'four-way',
        cellReach: CELL_REACH,
        onTapped,
        onStepped(from, to) {
            const edge = grid.edgeBetween(from, to);
            if (edge >= 0) onDraggedOver(edge);
        },
        onDragFinished,
        onDragCancelled: onDragFinished,
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to step into it, in cells, across and down, so a wobbly tap stays a tap. */
const CELL_REACH = 0.4;
