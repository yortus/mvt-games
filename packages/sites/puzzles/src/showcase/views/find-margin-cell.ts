import { MARGIN_GRID_SIZE, MARGIN_GRID_X, MARGIN_GRID_Y, PAGE_HEIGHT, PAGE_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the square of the margin game's grid at `x`, `z` on the desk, in
 * metres, from 0 at its top left, across each row and down, or -1 off the
 * grid. The grid is on the back page, which lies left of the spine.
 */
export function findMarginCell(x: number, z: number): number {
    const col = Math.floor(((x - MARGIN_GRID_LEFT) / MARGIN_GRID_SIDE) * 3);
    const row = Math.floor(((z - MARGIN_GRID_TOP) / MARGIN_GRID_SIDE) * 3);
    if (col < 0 || col > 2 || row < 0 || row > 2) return -1;
    return row * 3 + col;
}

/** Where the grid is on the desk: its left edge and top, and its side, in metres. */
export const MARGIN_GRID_LEFT = -PAGE_WIDTH + MARGIN_GRID_X * PAGE_WIDTH;
export const MARGIN_GRID_TOP = -PAGE_HEIGHT / 2 + MARGIN_GRID_Y * PAGE_HEIGHT;
export const MARGIN_GRID_SIDE = MARGIN_GRID_SIZE * PAGE_WIDTH;
