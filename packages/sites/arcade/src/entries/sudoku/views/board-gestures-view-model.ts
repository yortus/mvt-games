import type { GroupNote } from '../models';
import { createDoubleTapTracker } from './double-tap-tracker';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's taps and drags on the board mean. A tap selects a cell,
 * or takes one out of several selected, or clears the one selected. A drag
 * selects every cell it passes through the middle of, so it can run past a
 * cell's corner without taking it in. A tap on a group note's label selects
 * its cells. Tapping a cell twice, quickly, opens the choice of its number.
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
    /** Moves the clock on, which tells a tap from a press, and a double tap from two taps. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    /** The cells selected, which a tap adds to or takes from. */
    readonly selection: () => readonly number[];
    /** The group note whose label is at (`x`, `y`), if one is shown there. */
    readonly labelNoteAt: (x: number, y: number) => GroupNote | undefined;
    /** The player chose these cells for notes, or none. */
    readonly onSelected: (cells: readonly number[]) => void;
    /** The player tapped `cell` twice, quickly. */
    readonly onCellDoubleTapped: (cell: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gestures, with no finger down. */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): BoardGesturesViewModel {
    const { selection, labelNoteAt, onSelected, onCellDoubleTapped } = options;
    const taps = createDoubleTapTracker();
    let clockMs = 0;
    // The finger or mouse followed: where it went down and when, how far it has gone, and the cells a drag has passed through
    let pointer: number | undefined;
    let isDoubleTapping = false;
    let downX = 0;
    let downY = 0;
    let downMs = 0;
    let travel = 0;
    let draggedCells: number[] = [];
    let isDragging = false;
    // The group note whose label the pointer went down on, if any
    let labelNote: GroupNote | undefined;
    // Where the last tap was, which a second must be near to make a double tap
    let tapX = 0;
    let tapY = 0;

    return {
        press(pointerId, x, y) {
            if (pointer !== undefined || !isOnGrid(x, y)) return;
            const cell = toCell(x, y);
            pointer = pointerId;
            isDoubleTapping = taps.isSecondTap(cell) && Math.hypot(x - tapX, y - tapY) <= DOUBLE_TAP_REACH;
            if (isDoubleTapping) {
                taps.forget();
                onCellDoubleTapped(cell);
                return;
            }
            downX = x;
            downY = y;
            downMs = clockMs;
            travel = 0;
            draggedCells = [cell];
            isDragging = false;
            labelNote = labelNoteAt(x, y);
        },
        move(pointerId, x, y) {
            if (pointerId !== pointer || isDoubleTapping) return;
            travel = Math.max(travel, Math.hypot(x - downX, y - downY));
            dragThrough(x, y);
        },
        release(pointerId) {
            if (pointerId !== pointer) return;
            pointer = undefined;
            if (isDoubleTapping) {
                isDoubleTapping = false;
                return;
            }
            const cell = toCell(downX, downY);
            if (!isDragging) selectByTap(cell);
            const isTap = !isDragging && travel <= TAP_REACH && clockMs - downMs <= TAP_MS;
            if (isTap) taps.noteTap(cell);
            else taps.forget();
            tapX = downX;
            tapY = downY;
            isDragging = false;
            labelNote = undefined;
        },
        update(deltaMs) {
            clockMs += deltaMs;
            taps.update(deltaMs);
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

/** A tap is a touch let go within this time, in ms, and this distance, in cells. */
const TAP_MS = 300;
const TAP_REACH = 0.15;
/** How near a cell's middle a drag must pass to take the cell in, in cells, across and down. */
const DRAG_REACH = 0.38;
/** How near the first tap a second must be to make a double tap, in cells. */
const DOUBLE_TAP_REACH = 0.5;

function isOnGrid(x: number, y: number): boolean {
    return x >= 0 && x < 9 && y >= 0 && y < 9;
}

function toCell(x: number, y: number): number {
    return Math.floor(y) * 9 + Math.floor(x);
}
