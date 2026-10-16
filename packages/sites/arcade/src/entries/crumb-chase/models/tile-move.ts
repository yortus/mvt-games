// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A position a `TileMove` moves: a model's fractional row and column. */
export interface TilePosition {
    row: number;
    col: number;
}

/**
 * A one-tile move: a straight slide at constant speed from where a position is
 * to the next tile, advanced only by `advance(deltaMs)`. Allocates nothing, so
 * a model can make one per actor and reuse it for every move.
 */
export interface TileMove {
    /** Whether a move is under way. */
    readonly isMoving: boolean;
    /** Start sliding `position` from where it is now to (`toRow`, `toCol`), over `durationMs`. */
    start: (position: TilePosition, toRow: number, toCol: number, durationMs: number) => void;
    /** Abandon the move, leaving the position where it is. */
    stop: () => void;
    /**
     * Advance the move by `deltaMs`, updating `position`. Returns `true` on the
     * update it arrives, with `position` exactly on the target tile. Time past
     * the arrival is dropped: a move never carries over into the next one.
     */
    advance: (position: TilePosition, deltaMs: number) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTileMove(): TileMove {
    let isMoving = false;
    let fromRow = 0;
    let fromCol = 0;
    let toRow = 0;
    let toCol = 0;
    let durationMs = 0;
    let elapsedMs = 0;

    return {
        get isMoving() {
            return isMoving;
        },

        start(position, row, col, duration) {
            fromRow = position.row;
            fromCol = position.col;
            toRow = row;
            toCol = col;
            durationMs = duration;
            elapsedMs = 0;
            isMoving = true;
        },

        stop() {
            isMoving = false;
        },

        advance(position, deltaMs) {
            if (!isMoving) return false;
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) {
                position.row = toRow;
                position.col = toCol;
                isMoving = false;
                return true;
            }
            const t = elapsedMs / durationMs;
            position.row = fromRow + (toRow - fromRow) * t;
            position.col = fromCol + (toCol - fromCol) * t;
            return false;
        },
    };
}
