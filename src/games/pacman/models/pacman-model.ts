import gsap from 'gsap';
import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';

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
    setDirection(dir: Direction): void;
    /** Advance model state. */
    update(deltaMs: number): void;
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
        moving: false,
    };

    // Paused timeline - movement tweens, advanced only via update().
    // autoRemoveChildren cleans up completed tweens (see style-guide GSAP §).
    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

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
            if (state.moving && dir === oppositeDirection(state.direction)) {
                timeline.clear();
                state.tileRow += DIRECTION_DELTA[state.direction][0];
                state.tileCol += DIRECTION_DELTA[state.direction][1];
                state.direction = dir;
                state.moving = false;
            }
        },

        update(deltaMs: number): void {
            // Advance the timeline
            timeline.time(timeline.time() + 0.001 * deltaMs);

            // If idle, schedule the next one-tile move
            if (!state.moving) scheduleMove();
        },
    };

    return model;

    // Helpers ----------------------------------------------------------------

    function canMove(dir: Direction): boolean {
        const delta = DIRECTION_DELTA[dir];
        return isWalkable(state.tileRow + delta[0], state.tileCol + delta[1]);
    }

    /** Schedule a single one-tile move on the timeline. */
    function scheduleMove(): void {
        let dir = state.requestedDirection;
        if (!canMove(dir)) dir = state.direction;
        if (!canMove(dir)) return;

        state.direction = dir;
        state.moving = true;

        const delta = DIRECTION_DELTA[dir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];
        const dist = Math.abs(nextTileCol - state.col) + Math.abs(nextTileRow - state.row) || 0.001; // prevent zero-duration tween
        const duration = dist / speed;

        // Position new tweens at current playhead (see style-guide GSAP §).
        const t = timeline.time();
        timeline.to(state, { col: nextTileCol, row: nextTileRow, duration, ease: 'none' }, t);
        timeline.set(state, { tileRow: nextTileRow, tileCol: nextTileCol, moving: false }, t + duration);
    }
}
