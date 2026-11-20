import { createGridGesturesViewModel, type GridGesturesViewModel } from '@mvtjs/site-kit/input';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the gestures are created with. */
export interface BoardGesturesViewModelOptions {
    /** How many cells along each side of the harbour. */
    readonly size: number;
    /** The player tapped `cell`. */
    readonly onTapped: (cell: number) => void;
    /** The player began a drag at `cell`. */
    readonly onDragStarted: (cell: number) => void;
    /** The drag went into `cell`, after the one it began at. */
    readonly onDraggedOver: (cell: number) => void;
    /** The player let go, or the drag was cancelled, after dragging into a cell or more. */
    readonly onDragFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the taps and drags on the harbour. A tap is reported as the cell
 * it landed on. A drag is reported as it goes. First comes the cell it
 * began at, then each cell it steps into, and then the moment it ends. A
 * drag steps across and down, never diagonally. The puzzle's screen
 * decides what a drag does to its cells. Positions are in cells, across
 * and down from the harbour's top left corner.
 */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): GridGesturesViewModel {
    const { size, onTapped, onDragStarted, onDraggedOver, onDragFinished } = options;
    let isDragging = false;
    const finish = (): void => {
        if (isDragging) onDragFinished();
        isDragging = false;
    };
    return createGridGesturesViewModel({
        rows: size,
        cols: size,
        lattice: 'cells',
        steps: 'four-way',
        cellReach: CELL_REACH,
        onTapped,
        onStepped(from, to) {
            if (!isDragging) {
                isDragging = true;
                onDragStarted(from);
            }
            onDraggedOver(to);
        },
        onDragFinished: finish,
        onDragCancelled: finish,
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to step into it, in cells. A wobbly tap stays a tap. */
const CELL_REACH = 0.4;
