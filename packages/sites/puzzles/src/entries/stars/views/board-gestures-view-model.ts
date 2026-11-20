import { createGridGesturesViewModel } from '@mvtjs/site-kit/input';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Taps and drags on the grid. A tap is reported as the cell it landed on.
 * A drag gathers the cells it goes over, stepping across and down, never
 * diagonally, so each cell it gathers shares a side with one before it. A
 * diagonal move goes through a cell beside both. The drag is reported as
 * those cells once the player lets go, if there are two or more. Going back
 * over the cell before the last lets the last one go again, so a drag can
 * be put right before it is let go.
 */
export interface BoardGesturesViewModel {
    /** A finger, or the mouse, went down at (`x`, `y`), in cells, across and down from the grid's top left corner. */
    press: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    release: () => void;
    /** The pointer was taken away, so the drag is dropped, and a press is no tap. */
    cancel: () => void;
    /** The cells the drag being made has gathered, in order, or none. */
    readonly draggedCells: readonly number[];
    /** A count that rises as the drag's cells change, so they are drawn again only then. */
    readonly dragChanges: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    /** How many cells along each side of the grid. */
    readonly size: number;
    /** The player tapped `cell`. */
    readonly onTapped: (cell: number) => void;
    /** The player dragged over `cells`, two or more, in order, and let go. */
    readonly onDragged: (cells: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the taps and drags on the grid, with no finger down. */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): BoardGesturesViewModel {
    const { size, onTapped, onDragged } = options;
    let cells: number[] = [];
    let dragChanges = 0;
    const gestures = createGridGesturesViewModel({
        rows: size,
        cols: size,
        lattice: 'cells',
        steps: 'four-way',
        cellReach: CELL_REACH,
        onTapped,
        onStepped(from, to) {
            if (cells.length === 0) cells.push(from);
            if (cells.length >= 2 && cells[cells.length - 2] === to) cells.pop();
            else if (!cells.includes(to)) cells.push(to);
            dragChanges++;
        },
        onDragFinished() {
            const dragged = cells;
            dropDrag();
            if (dragged.length >= 2) onDragged(dragged);
        },
        onDragCancelled: dropDrag,
    });
    return {
        press: gestures.press,
        move: gestures.move,
        release: gestures.release,
        cancel: gestures.cancel,
        get draggedCells() { return cells; },
        get dragChanges() { return dragChanges; },
    };

    function dropDrag(): void {
        cells = [];
        dragChanges++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to step into it, in cells, across and down, so a wobbly tap stays a tap. */
const CELL_REACH = 0.4;
