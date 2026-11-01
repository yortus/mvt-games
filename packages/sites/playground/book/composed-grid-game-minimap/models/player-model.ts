import type { GridModel } from './grid-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the player moves, in cells per ms. */
const SPEED = 0.005;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A way to move on the grid. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * The player, who moves steadily from cell to cell in the direction they
 * face, and stops at a wall. A turn is remembered, and taken at the first
 * cell where it's open, so you can turn a little before a corner.
 */
export interface PlayerModel {
    /** Where the player is, in cells. Between two cells, it's a fraction. */
    readonly row: number;
    readonly col: number;
    readonly direction: Direction;
    /** Turns the player as soon as the way is open. Turning back happens at once. */
    readonly turnTo: (direction: Direction) => void;
    /** Puts the player back at the start, facing right. */
    readonly respawn: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlayerModelOptions {
    /** The grid the player moves on. */
    readonly grid: GridModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a player at the grid's start, facing right. */
export function createPlayerModel({ grid }: PlayerModelOptions): PlayerModel {
    // The cell the player is in or has just left, and how far they are
    // towards the next cell, from 0 to 1
    let cellRow = grid.startRow;
    let cellCol = grid.startCol;
    let progress = 0;
    let direction: Direction = 'right';
    let wantedDirection: Direction = 'right';

    const model: PlayerModel = {
        get row() { return cellRow + ROW_STEP[direction] * progress; },
        get col() { return cellCol + COL_STEP[direction] * progress; },
        get direction() { return direction; },

        turnTo(newDirection) {
            wantedDirection = newDirection;
            if (progress > 0 && newDirection === OPPOSITE[direction]) {
                // Turn back at once: head for the cell just left
                cellRow += ROW_STEP[direction];
                cellCol += COL_STEP[direction];
                progress = 1 - progress;
                direction = newDirection;
            }
        },

        respawn() {
            cellRow = grid.startRow;
            cellCol = grid.startCol;
            progress = 0;
            direction = 'right';
            wantedDirection = 'right';
        },

        update(deltaMs) {
            let distance = SPEED * deltaMs;
            while (distance > 0) {
                if (progress === 0) {
                    // In the middle of a cell, where the player can turn or stop
                    if (canMove(wantedDirection)) direction = wantedDirection;
                    if (!canMove(direction)) return;
                }
                const toNextCell = 1 - progress;
                if (distance < toNextCell) {
                    progress += distance;
                    return;
                }
                distance -= toNextCell;
                cellRow += ROW_STEP[direction];
                cellCol += COL_STEP[direction];
                progress = 0;
            }
        },
    };

    return model;

    function canMove(towards: Direction): boolean {
        return grid.isOpenAt(cellRow + ROW_STEP[towards], cellCol + COL_STEP[towards]);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ROW_STEP: Readonly<Record<Direction, number>> = { up: -1, down: 1, left: 0, right: 0 };
const COL_STEP: Readonly<Record<Direction, number>> = { up: 0, down: 0, left: -1, right: 1 };
const OPPOSITE: Readonly<Record<Direction, Direction>> = { up: 'down', down: 'up', left: 'right', right: 'left' };
