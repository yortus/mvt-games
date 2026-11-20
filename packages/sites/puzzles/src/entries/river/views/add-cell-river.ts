import type { Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Adds the line of the river through one cell to `graphics`, for the caller
 * to stroke. The cell's top left corner is at `left` and `top`. `sides` has
 * one bit for each side that the river runs through. From the lowest bit,
 * the bits are up, right, down and left. The line starts from the middle of
 * each of those sides. Between opposite sides it runs straight across, and between
 * two sides that meet it curves round the cell's middle. From one side, or
 * from three or four, each part runs in to the middle.
 */
export function addCellRiver(graphics: Graphics, left: number, top: number, cellSize: number, sides: number): void {
    const middleX = left + cellSize / 2;
    const middleY = top + cellSize / 2;
    let count = 0;
    for (let side = 0; side < 4; side++) count += (sides >> side) & 1;
    if (count === 2) {
        let first = -1;
        let second = -1;
        for (let side = 0; side < 4; side++) {
            if (((sides >> side) & 1) === 0) continue;
            if (first < 0) first = side;
            else second = side;
        }
        const toX = left + SIDE_X[second] * cellSize;
        const toY = top + SIDE_Y[second] * cellSize;
        graphics.moveTo(left + SIDE_X[first] * cellSize, top + SIDE_Y[first] * cellSize);
        // Straight across between opposite sides, or a curve round the middle between sides that meet
        if (second - first === 2) graphics.lineTo(toX, toY);
        else graphics.quadraticCurveTo(middleX, middleY, toX, toY);
        return;
    }
    for (let side = 0; side < 4; side++) {
        if (((sides >> side) & 1) === 0) continue;
        graphics.moveTo(left + SIDE_X[side] * cellSize, top + SIDE_Y[side] * cellSize).lineTo(middleX, middleY);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far across a cell the middle of each side is, up, right, down and left, as a share of the cell. */
const SIDE_X: readonly number[] = [0.5, 1, 0.5, 0];

/** How far down a cell the middle of each side is, up, right, down and left, as a share of the cell. */
const SIDE_Y: readonly number[] = [0, 0.5, 1, 0.5];
