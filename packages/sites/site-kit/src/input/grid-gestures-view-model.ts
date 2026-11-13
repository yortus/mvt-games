// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a drag over a grid follows. It is the grid's cells, or the corners where its lines meet. */
export type GridLattice = 'cells' | 'corners';

/** How a drag steps from one place to the next. A four-way drag steps only across and down. An eight-way drag steps diagonally too. */
export type GridSteps = 'four-way' | 'eight-way';

/**
 * Taps and drags over a grid, as steps from place to place. A place is a
 * cell, or a corner where the grid's lines meet. A press let go without a
 * step is a tap. A drag reaches a place by passing near its middle. It steps
 * there from the place it reached last, one neighbour at a time. So a fast
 * drag skips nothing.
 *
 * It follows one finger or the mouse. It doesn't decide what a step means.
 * The code it reports to decides that. Positions are in cells, across and
 * down from the grid's top left corner. So it works without pixels or a
 * renderer, and a test can drive it directly. Places are numbered row by row
 * from the top left. A row of cells has `cols` places, and a row of corners
 * has `cols + 1`.
 */
export interface GridGesturesViewModel {
    /** A finger, or the mouse, went down at (`x`, `y`). */
    press: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    release: () => void;
    /** The pointer was taken away, so a drag stops where it is, and a press is no tap. */
    cancel: () => void;
    /** Whether a press is being followed. */
    readonly isPressed: boolean;
    /** What the press being followed, or the last, follows. */
    readonly lattice: GridLattice;
    /** The place the press landed in, or nearest, or -1 off the grid. It stays until the next press. */
    readonly pressedPlace: number;
    /** The place the drag reached last, or -1 if none yet. It stays until the next press. */
    readonly place: number;
    /** Where the pointer was last, in cells. */
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridGesturesViewModelOptions {
    /** The grid's size, in cells. */
    readonly rows: number;
    readonly cols: number;
    /**
     * What a drag follows. With `'nearest'`, a press nearer a corner than the
     * middle of a cell follows corners, and any other follows cells. A press
     * off the grid is nearest a corner.
     */
    readonly lattice: GridLattice | 'nearest';
    readonly steps: GridSteps;
    /**
     * How near a place's middle a moving pointer must pass to reach it, in
     * cells, across and down. 0.5, the default, is anywhere in a cell, or
     * nearer a corner than any other.
     */
    readonly cellReach?: number;
    readonly cornerReach?: number;
    /** Whether a press counts, read as each one lands. Always, without it. */
    readonly isEnabled?: () => boolean;
    /** The player tapped `place`, where a press at (`x`, `y`) landed. Not for a press off the grid. */
    readonly onTapped?: (place: number, x: number, y: number) => void;
    /** The player dragged from `from` to `to`, a neighbour. */
    readonly onStepped?: (from: number, to: number) => void;
    /** The player let go after a step or more. */
    readonly onDragFinished?: () => void;
    /** The pointer was taken away after a step or more. */
    readonly onDragCancelled?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gestures, with no finger down. */
export function createGridGesturesViewModel(options: GridGesturesViewModelOptions): GridGesturesViewModel {
    const { rows, cols, steps, cellReach = 0.5, cornerReach = 0.5, isEnabled, onTapped, onStepped, onDragFinished, onDragCancelled } = options;
    // The press followed, what it follows, where it landed, and where the drag has reached
    let isPressed = false;
    let lattice: GridLattice = options.lattice === 'corners' ? 'corners' : 'cells';
    let pressedPlace = -1;
    let place = -1;
    let hasStepped = false;
    let pressX = 0;
    let pressY = 0;
    let pointerX = 0;
    let pointerY = 0;

    return {
        press(x, y) {
            if (isPressed || (isEnabled !== undefined && !isEnabled())) return;
            isPressed = true;
            pressX = pointerX = x;
            pressY = pointerY = y;
            lattice = options.lattice === 'nearest' ? findNearestLattice(x, y, rows, cols) : options.lattice;
            pressedPlace = findPlaceUnder(x, y);
            place = pressedPlace;
            hasStepped = false;
        },
        move(x, y) {
            if (!isPressed) return;
            pointerX = x;
            pointerY = y;
            const reached = findPlaceReached(x, y);
            if (reached < 0) return;
            if (place < 0) {
                place = reached;
                return;
            }
            const width = lattice === 'cells' ? cols : cols + 1;
            while (place !== reached) {
                const rowGap = Math.floor(reached / width) - Math.floor(place / width);
                const colGap = (reached % width) - (place % width);
                let next: number;
                if (steps === 'eight-way') next = place + Math.sign(colGap) + Math.sign(rowGap) * width;
                // Along the longer way first
                else next = Math.abs(colGap) >= Math.abs(rowGap) ? place + Math.sign(colGap) : place + Math.sign(rowGap) * width;
                const from = place;
                place = next;
                hasStepped = true;
                onStepped?.(from, next);
            }
        },
        release() {
            if (!isPressed) return;
            isPressed = false;
            if (hasStepped) onDragFinished?.();
            else if (pressedPlace >= 0) onTapped?.(pressedPlace, pressX, pressY);
        },
        cancel() {
            if (!isPressed) return;
            isPressed = false;
            if (hasStepped) onDragCancelled?.();
        },
        get isPressed() { return isPressed; },
        get lattice() { return lattice; },
        get pressedPlace() { return pressedPlace; },
        get place() { return place; },
        get x() { return pointerX; },
        get y() { return pointerY; },
    };

    /** The place (`x`, `y`) is in, for cells, or nearest, for corners, or -1 off the grid. */
    function findPlaceUnder(x: number, y: number): number {
        if (lattice === 'cells') {
            const col = Math.floor(x);
            const row = Math.floor(y);
            return col >= 0 && col < cols && row >= 0 && row < rows ? row * cols + col : -1;
        }
        const col = Math.round(x);
        const row = Math.round(y);
        return col >= 0 && col <= cols && row >= 0 && row <= rows ? row * (cols + 1) + col : -1;
    }

    /** The place whose middle (`x`, `y`) is near enough to reach, or -1. */
    function findPlaceReached(x: number, y: number): number {
        const found = findPlaceUnder(x, y);
        if (found < 0) return -1;
        if (lattice === 'cells') {
            const isNearMiddle = Math.abs(x - Math.floor(x) - 0.5) < cellReach && Math.abs(y - Math.floor(y) - 0.5) < cellReach;
            return isNearMiddle ? found : -1;
        }
        const isNearCorner = Math.abs(x - Math.round(x)) < cornerReach && Math.abs(y - Math.round(y)) < cornerReach;
        return isNearCorner ? found : -1;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether (`x`, `y`) is nearer a corner of a grid than the middle of a cell. Off the grid, only corners are near. */
function findNearestLattice(x: number, y: number, rows: number, cols: number): GridLattice {
    if (x < 0 || x > cols || y < 0 || y > rows) return 'corners';
    const toMiddle = Math.hypot(x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5);
    const toCorner = Math.hypot(x - Math.round(x), y - Math.round(y));
    return toCorner < toMiddle ? 'corners' : 'cells';
}
