import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';
import { createTileMove } from './tile-move';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PacmanModel {
    /** Current row position (fractional while moving between tiles). */
    readonly row: number;
    /** Current column position (fractional while moving between tiles). */
    readonly col: number;
    /** Current movement direction. */
    readonly direction: Direction;
    /** Request a direction change. Applied at the next tile centre if valid. */
    setDirection: (dir: Direction) => void;
    /** Advance model state. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PacmanModelOptions {
    startRow: number;
    startCol: number;
    /** Tiles per second. */
    speed: number;
    /** Returns whether the given tile can be walked on. */
    isWalkable: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPacmanModel(options: PacmanModelOptions): PacmanModel {
    const { startRow, startCol, speed, isWalkable } = options;

    // Internal mutable state -------------------------------------------------
    const state = {
        row: startRow,
        col: startCol,
        tileRow: startRow,
        tileCol: startCol,
        direction: 'left' as Direction,
        requestedDirection: 'left' as Direction,
    };

    // The current tile-to-tile move, advanced only via update().
    const move = createTileMove();

    // Public model record ----------------------------------------------------

    const model: PacmanModel = {
        get row() {
            return state.row;
        },
        get col() {
            return state.col;
        },
        get direction() {
            return state.direction;
        },

        setDirection(dir: Direction): void {
            state.requestedDirection = dir;

            // Allow instant reversal while moving - keep visual position,
            // advance logical tile to the one we were heading toward so that
            // scheduleMove naturally targets the tile we came from.
            if (move.isMoving && dir === oppositeDirection(state.direction)) {
                move.stop();
                state.tileRow += DIRECTION_DELTA[state.direction][0];
                state.tileCol += DIRECTION_DELTA[state.direction][1];
                state.direction = dir;
            }
        },

        update(deltaMs: number): void {
            // Advance the move; on arrival, Pac-Man is on his new tile
            if (move.advance(state, deltaMs)) {
                state.tileRow = state.row;
                state.tileCol = state.col;
            }

            // If idle, schedule the next one-tile move
            if (!move.isMoving) scheduleMove();
        },
    };

    return model;

    // Helpers ----------------------------------------------------------------

    function canMove(dir: Direction): boolean {
        const delta = DIRECTION_DELTA[dir];
        return isWalkable(state.tileRow + delta[0], state.tileCol + delta[1]);
    }

    /** Start a single one-tile move. */
    function scheduleMove(): void {
        let dir = state.requestedDirection;
        if (!canMove(dir)) dir = state.direction;
        if (!canMove(dir)) return;

        state.direction = dir;

        const delta = DIRECTION_DELTA[dir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];
        const dist = Math.abs(nextTileCol - state.col) + Math.abs(nextTileRow - state.row) || 0.001; // prevent zero-duration tween
        move.start(state, nextTileRow, nextTileCol, (1000 * dist) / speed);
    }
}
