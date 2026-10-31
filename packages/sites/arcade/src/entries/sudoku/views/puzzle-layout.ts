import { COLUMN_OF, ROW_OF } from '#sudoku-digger';
import { CELL_SIZE, GRID_X, GRID_Y, KEY_GAP, KEY_HEIGHT, KEY_WIDTH, KEYPAD_Y } from './view-constants';

// Where the puzzle's screen puts a cell or a key, in the screen's pixels.
// The keypad lays its keys out from here, and the views that point at a
// cell or a key, such as the tutorial's arrow and the number picker, find
// them here, so they can never drift apart.

/** The left edge of the key for `digit`, from the keypad's left edge. */
export function findKeyLeft(digit: number): number {
    return (digit - 1) * (KEY_WIDTH + KEY_GAP);
}

/** The middle of the key for `digit`, across the screen. */
export function findKeyMiddleX(digit: number): number {
    return GRID_X + findKeyLeft(digit) + KEY_WIDTH / 2;
}

/** The middle of every key, down the screen. */
export const KEY_MIDDLE_Y = KEYPAD_Y + KEY_HEIGHT / 2;

/** The middle of `cell`, across and down the screen. */
export function findCellMiddleX(cell: number): number {
    return GRID_X + (COLUMN_OF[cell] + 0.5) * CELL_SIZE;
}

export function findCellMiddleY(cell: number): number {
    return GRID_Y + (ROW_OF[cell] + 0.5) * CELL_SIZE;
}

/** The top edge of `cell`, down the screen. */
export function findCellTop(cell: number): number {
    return GRID_Y + ROW_OF[cell] * CELL_SIZE;
}
