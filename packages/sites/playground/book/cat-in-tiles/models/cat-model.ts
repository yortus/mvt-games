// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the cat walks, in tiles per ms. */
const SPEED = 0.004;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The way the cat is walking, or last walked. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * A cat that explores a maze of tiles by keeping its right paw on the wall.
 * Its position is in tiles, not pixels: a whole number is the middle of a
 * tile, and a fraction is part of the way to the next.
 */
export interface CatModel {
    /** The row, with a fraction while moving between tiles. */
    readonly row: number;
    /** The column, with a fraction while moving between tiles. */
    readonly col: number;
    readonly direction: Direction;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CatModelOptions {
    /** Whether the tile can be walked on. */
    readonly isWalkable: (row: number, col: number) => boolean;
    /** The tile the cat starts in, facing right. */
    readonly startRow: number;
    readonly startCol: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a cat in the middle of its starting tile, facing right. */
export function createCatModel(options: CatModelOptions): CatModel {
    const { isWalkable } = options;
    // The tile the cat is leaving, and how far it has gone towards the next, from 0 to 1
    let tileRow = options.startRow;
    let tileCol = options.startCol;
    let travelled = 0;
    let direction: Direction = 'right';

    return {
        get row() { return tileRow + rowStepOf(direction) * travelled; },
        get col() { return tileCol + colStepOf(direction) * travelled; },
        get direction() { return direction; },

        update(deltaMs) {
            let distance = SPEED * deltaMs;
            while (distance > 0) {
                // In the middle of a tile, the cat chooses its way on
                if (travelled === 0) {
                    direction = chooseDirection();
                    if (!canGo(direction)) return;
                }
                const toNextTile = 1 - travelled;
                if (distance < toNextTile) {
                    travelled += distance;
                    return;
                }
                // It reaches the middle of the next tile, with some distance to spare
                distance -= toNextTile;
                tileRow += rowStepOf(direction);
                tileCol += colStepOf(direction);
                travelled = 0;
            }
        },
    };

    /** Turns right if it can, or else goes straight on, or else turns left, or else back. */
    function chooseDirection(): Direction {
        const right = turnRightFrom(direction);
        if (canGo(right)) return right;
        if (canGo(direction)) return direction;
        const left = turnRightFrom(turnRightFrom(right));
        if (canGo(left)) return left;
        return turnRightFrom(right);
    }

    function canGo(way: Direction): boolean {
        return isWalkable(tileRow + rowStepOf(way), tileCol + colStepOf(way));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function rowStepOf(direction: Direction): number {
    if (direction === 'up') return -1;
    if (direction === 'down') return 1;
    return 0;
}

function colStepOf(direction: Direction): number {
    if (direction === 'left') return -1;
    if (direction === 'right') return 1;
    return 0;
}

function turnRightFrom(direction: Direction): Direction {
    if (direction === 'up') return 'right';
    if (direction === 'right') return 'down';
    if (direction === 'down') return 'left';
    return 'up';
}
