import type { GroupNote } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's taps and drags on the board mean. A tap selects a cell,
 * empty or filled in, or takes one out of several selected, or clears the
 * one selected. A drag
 * selects every cell it passes through the middle of, so it can run past a
 * cell's corner without taking it in. A tap on a group note's label selects
 * its cells.
 *
 * It follows one finger or the mouse at a time. Positions are in cells,
 * across and down the grid, so it knows nothing of pixels or of Pixi, and
 * a test can play it directly.
 */
export interface BoardGesturesViewModel {
    /** A finger, or the mouse, went down at (`x`, `y`). */
    press: (pointerId: number, x: number, y: number) => void;
    move: (pointerId: number, x: number, y: number) => void;
    release: (pointerId: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    /** The cells selected, which a tap adds to or takes from. */
    readonly selection: () => readonly number[];
    /** The group note whose label is at (`x`, `y`), if one is shown there. */
    readonly labelNoteAt: (x: number, y: number) => GroupNote | undefined;
    /** The player chose these cells, or none. */
    readonly onSelected: (cells: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gestures, with no finger down. */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): BoardGesturesViewModel {
    const { selection, labelNoteAt, onSelected } = options;
    // The finger or mouse followed: where it went down, and the cells a drag has passed through
    let pointer: number | undefined;
    let downX = 0;
    let downY = 0;
    let draggedCells: number[] = [];
    let isDragging = false;
    // The group note whose label the pointer went down on, if any
    let labelNote: GroupNote | undefined;

    return {
        press(pointerId, x, y) {
            if (pointer !== undefined || !isOnGrid(x, y)) return;
            pointer = pointerId;
            downX = x;
            downY = y;
            draggedCells = [toCell(x, y)];
            isDragging = false;
            labelNote = labelNoteAt(x, y);
        },
        move(pointerId, x, y) {
            if (pointerId !== pointer) return;
            dragThrough(x, y);
        },
        release(pointerId) {
            if (pointerId !== pointer) return;
            pointer = undefined;
            if (!isDragging) selectByTap(toCell(downX, downY));
            isDragging = false;
            labelNote = undefined;
        },
    };

    /** Takes the cell at (`x`, `y`) into the drag's selection, if the pointer is near its middle. */
    function dragThrough(x: number, y: number): void {
        if (!isOnGrid(x, y)) return;
        const isNearMiddle = Math.abs((x % 1) - 0.5) < DRAG_REACH && Math.abs((y % 1) - 0.5) < DRAG_REACH;
        const cell = toCell(x, y);
        if (!isNearMiddle || draggedCells.includes(cell)) return;
        draggedCells.push(cell);
        isDragging = true;
        onSelected(draggedCells);
    }

    /** What a tap does, by what is selected already. */
    function selectByTap(cell: number): void {
        const selected = selection();
        if (labelNote !== undefined) onSelected(labelNote.cells);
        else if (selected.length > 1 && selected.includes(cell)) onSelected(selected.filter((each) => each !== cell));
        else if (selected.length === 1 && selected[0] === cell) onSelected([]);
        else onSelected([cell]);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to take the cell in, in cells, across and down. */
const DRAG_REACH = 0.38;

function isOnGrid(x: number, y: number): boolean {
    return x >= 0 && x < 9 && y >= 0 && y < 9;
}

function toCell(x: number, y: number): number {
    return Math.floor(y) * 9 + Math.floor(x);
}
