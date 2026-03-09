import gsap from 'gsap';
import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PacmanModel {
    /** Visual x position in grid-unit space (tweened). */
    readonly x: number;
    /** Visual y position in grid-unit space (tweened). */
    readonly y: number;
    /** Current logical tile column. */
    readonly col: number;
    /** Current logical tile row. */
    readonly row: number;
    /** Current movement direction. */
    readonly direction: Direction;
    /** Progress through the current step (0 = at tile centre, 1 = arrived at next tile). 0 when idle. */
    readonly stepProgress: number;
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
    const state: {
        x: number;
        y: number;
        col: number;
        row: number;
        direction: Direction;
        requestedDirection: Direction;
        moving: boolean;
    } = {
        x: startCol,
        y: startRow,
        col: startCol,
        row: startRow,
        direction: 'left',
        requestedDirection: 'left',
        moving: false,
    };

    // Paused timeline — movement tweens, advanced only via update().
    // autoRemoveChildren cleans up completed tweens (see style-guide GSAP §).
    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    // Helpers ----------------------------------------------------------------

    function canMove(dir: Direction): boolean {
        const delta = DIRECTION_DELTA[dir];
        return isWalkable(state.row + delta[0], state.col + delta[1]);
    }

    /** Schedule a single one-tile move on the timeline. */
    function scheduleMove(): void {
        let dir = state.requestedDirection;
        if (!canMove(dir)) dir = state.direction;
        if (!canMove(dir)) return;

        state.direction = dir;
        state.moving = true;

        const delta = DIRECTION_DELTA[dir];
        const nextRow = state.row + delta[0];
        const nextCol = state.col + delta[1];
        const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y) || 0.001; // prevent zero-duration tween
        const duration = dist / speed;

        // Position new tweens at current playhead (see style-guide GSAP §).
        const t = timeline.time();
        timeline.to(state, { x: nextCol, y: nextRow, duration, ease: 'none' }, t);
        timeline.set(state, { row: nextRow, col: nextCol, moving: false }, t + duration);
    }

    // Public model record ----------------------------------------------------

    const model: PacmanModel = {
        get x() {
            return state.x;
        },
        get y() {
            return state.y;
        },
        get col() {
            return state.col;
        },
        get row() {
            return state.row;
        },
        get direction() {
            return state.direction;
        },
        get stepProgress() {
            if (!state.moving) return 0;
            return Math.abs(state.x - state.col) + Math.abs(state.y - state.row);
        },

        setDirection(dir: Direction): void {
            state.requestedDirection = dir;

            // Allow instant reversal while moving — keep visual position,
            // advance logical tile to the one we were heading toward so that
            // scheduleMove naturally targets the tile we came from.
            if (state.moving && dir === oppositeDirection(state.direction)) {
                timeline.clear();
                const delta = DIRECTION_DELTA[state.direction];
                state.row += delta[0];
                state.col += delta[1];
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
}
