// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which way the digger is heading, or `none` to stop at the next tile's middle. */
export type Direction = 'none' | 'up' | 'down' | 'left' | 'right';

/**
 * A digger that walks a field of tiles, one tile at a time, in the direction
 * it's given. It stops in the middle of a tile when the next one can't be
 * walked on, and digs through dirt at half speed. It asks about the field
 * through two functions it's given, so it knows nothing else about it.
 * Positions are in tiles, fractional while it's between two.
 */
export interface DiggerModel {
    readonly row: number;
    readonly col: number;
    readonly direction: Direction;
    /** Whether the digger moved in the last update. */
    readonly isMoving: boolean;
    /** Sets the way to head. A turn onto the other axis starts from the middle of the nearest tile. */
    readonly setDirection: (direction: Direction) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DiggerModelOptions {
    readonly startRow: number;
    readonly startCol: number;
    /** How fast the digger walks, in tiles per second. */
    readonly speed: number;
    readonly fieldRows: number;
    readonly fieldCols: number;
    /** Returns whether the digger can walk on a tile. */
    readonly isWalkable: (row: number, col: number) => boolean;
    /** Returns whether a tile is dirt, which the digger digs through at half speed. */
    readonly isDirt: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a digger standing still in the middle of its start tile. */
export function createDiggerModel(options: DiggerModelOptions): DiggerModel {
    const { speed, fieldRows, fieldCols, isWalkable, isDirt } = options;
    let row = options.startRow;
    let col = options.startCol;
    let direction: Direction = 'none';
    let isMoving = false;

    const model: DiggerModel = {
        get row() { return row; },
        get col() { return col; },
        get direction() { return direction; },
        get isMoving() { return isMoving; },

        setDirection(next) {
            if (isVertical(next) !== isVertical(direction)) {
                row = Math.round(row);
                col = Math.round(col);
            }
            direction = next;
        },

        update(deltaMs) {
            isMoving = false;
            if (direction === 'none') return;
            const rowStep = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
            const colStep = direction === 'right' ? 1 : direction === 'left' ? -1 : 0;
            // How far the digger may go this update, in tiles of open ground
            let budget = speed * deltaMs / 1000;
            while (budget > 0) {
                // The tile it's heading for. From a tile's middle, that's the
                // next one, if it can go there. Between two, it's the one ahead.
                let toRow = rowStep > 0 ? Math.ceil(row) : rowStep < 0 ? Math.floor(row) : row;
                let toCol = colStep > 0 ? Math.ceil(col) : colStep < 0 ? Math.floor(col) : col;
                if (toRow === row && toCol === col) {
                    toRow += rowStep;
                    toCol += colStep;
                    if (!canEnter(toRow, toCol)) return;
                }
                const pace = isDirt(toRow, toCol) ? DIG_PACE : 1;
                const distance = Math.abs(toRow - row) + Math.abs(toCol - col);
                isMoving = true;
                if (budget * pace >= distance) {
                    row = toRow;
                    col = toCol;
                    budget -= distance / pace;
                }
                else {
                    row += rowStep * budget * pace;
                    col += colStep * budget * pace;
                    budget = 0;
                }
            }
        },
    };

    return model;

    function canEnter(toRow: number, toCol: number): boolean {
        if (toRow < 0 || toRow >= fieldRows || toCol < 0 || toCol >= fieldCols) return false;
        return isWalkable(toRow, toCol);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The share of its speed the digger keeps while it digs through dirt. */
const DIG_PACE = 0.5;

function isVertical(direction: Direction): boolean {
    return direction === 'up' || direction === 'down';
}
