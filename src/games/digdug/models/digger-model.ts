import gsap from 'gsap';
import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface DiggerModel {
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
    /** Progress through the current step (0 = at tile centre, 1 = arrived). */
    readonly stepProgress: number;
    /** Whether the player is alive. */
    readonly alive: boolean;
    /** Whether the pump harpoon is currently extended. */
    readonly harpoonExtended: boolean;
    /** How far the harpoon extends (0→maxRange, in tiles). */
    readonly harpoonDistance: number;
    /** Request a direction change ('none' = stop). */
    setDirection(dir: Direction): void;
    /** Lock the harpoon at its current distance (while attached to an enemy). */
    lockHarpoon(locked: boolean): void;
    /** Extend harpoon in current direction. */
    startPump(): void;
    /** Retract harpoon. */
    stopPump(): void;
    /** Kill the digger. */
    kill(): void;
    /** Respawn at a position. */
    respawn(row: number, col: number): void;
    /** Advance model state. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DiggerModelOptions {
    startRow: number;
    startCol: number;
    /** Tiles per second. */
    speed: number;
    /** Maximum harpoon range in tiles. */
    maxHarpoonRange?: number;
    /** Total field rows. */
    fieldRows: number;
    /** Total field columns. */
    fieldCols: number;
    /** Returns whether the given tile can be walked on. */
    isWalkable: (row: number, col: number) => boolean;
    /** Returns whether the given tile is dirt (can be dug). */
    isDirt: (row: number, col: number) => boolean;
    /**
     * Called each tick with the harpoon tip position (row, col).
     * Return the max distance the harpoon may extend (e.g. limited by dirt).
     */
    getHarpoonMaxDistance?: (direction: Direction, fromRow: number, fromCol: number, maxRange: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const HARPOON_SPEED = 12; // tiles per second (extend/retract)

export function createDiggerModel(options: DiggerModelOptions): DiggerModel {
    const {
        startRow, startCol, speed, maxHarpoonRange = 4,
        isWalkable, isDirt, fieldRows, fieldCols, getHarpoonMaxDistance,
    } = options;

    const state: {
        x: number;
        y: number;
        col: number;
        row: number;
        direction: Direction;
        requestedDirection: Direction;
        moving: boolean;
        alive: boolean;
        harpoonExtended: boolean;
        harpoonDistance: number;
        harpoonLocked: boolean;
        pumping: boolean;
    } = {
        x: startCol,
        y: startRow,
        col: startCol,
        row: startRow,
        direction: 'right',
        requestedDirection: 'none',
        moving: false,
        alive: true,
        harpoonExtended: false,
        harpoonDistance: 0,
        harpoonLocked: false,
        pumping: false,
    };

    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });
    const harpoonTimeline = gsap.timeline({ paused: true });

    // ---- Helpers -----------------------------------------------------------

    function inBounds(row: number, col: number): boolean {
        return row >= 0 && row < fieldRows && col >= 0 && col < fieldCols;
    }

    function canMove(dir: Direction): boolean {
        const delta = DIRECTION_DELTA[dir];
        const nr = state.row + delta[0];
        const nc = state.col + delta[1];
        if (!inBounds(nr, nc)) return false;
        return isWalkable(nr, nc) || isDirt(nr, nc);
    }

    function effectiveHarpoonMax(): number {
        if (getHarpoonMaxDistance) {
            return getHarpoonMaxDistance(state.direction, state.row, state.col, maxHarpoonRange);
        }
        return maxHarpoonRange;
    }

    function scheduleHarpoonExtend(): void {
        const max = effectiveHarpoonMax();
        const remaining = max - state.harpoonDistance;
        if (remaining <= 0) return;
        const duration = remaining / HARPOON_SPEED;

        harpoonTimeline.clear().time(0);
        harpoonTimeline.to(state, { harpoonDistance: max, duration, ease: 'none' });
    }

    function scheduleHarpoonRetract(): void {
        const duration = state.harpoonDistance / HARPOON_SPEED;
        if (duration <= 0) {
            state.harpoonDistance = 0;
            state.harpoonExtended = false;
            return;
        }

        harpoonTimeline.clear().time(0);
        harpoonTimeline.to(state, { harpoonDistance: 0, duration, ease: 'none' });
        harpoonTimeline.call(() => { state.harpoonExtended = false; }, undefined, duration);
    }

    function scheduleMove(): void {
        if (!state.alive || state.harpoonExtended) return;
        if (state.requestedDirection === 'none') return;

        const requested = state.requestedDirection;
        if (canMove(requested)) {
            state.direction = requested;
        } else if (state.direction !== 'none' && canMove(state.direction)) {
            // Keep current direction
        } else {
            return;
        }

        state.moving = true;

        const delta = DIRECTION_DELTA[state.direction];
        const nextRow = state.row + delta[0];
        const nextCol = state.col + delta[1];
        const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y) || 0.001;
        const duration = dist / speed;

        const t = timeline.time();
        timeline.to(state, { x: nextCol, y: nextRow, duration, ease: 'none' }, t);
        timeline.set(state, { row: nextRow, col: nextCol, moving: false }, t + duration);
    }

    // ---- Public record -----------------------------------------------------

    const model: DiggerModel = {
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
        get alive() {
            return state.alive;
        },
        get harpoonExtended() {
            return state.harpoonExtended;
        },
        get harpoonDistance() {
            return state.harpoonDistance;
        },

        setDirection(dir: Direction): void {
            state.requestedDirection = dir;

            // If harpoon is locked and player changes direction, release it
            if (dir !== 'none' && state.harpoonExtended && state.harpoonLocked && dir !== state.direction) {
                state.harpoonLocked = false;
                state.pumping = false;
                state.harpoonDistance = 0;
                state.harpoonExtended = false;
                harpoonTimeline.clear().time(0);
                state.direction = dir;
                return;
            }

            if (dir !== 'none' && state.moving && dir === oppositeDirection(state.direction)) {
                timeline.clear();
                const delta = DIRECTION_DELTA[state.direction];
                state.row += delta[0];
                state.col += delta[1];
                state.direction = dir;
                state.moving = false;
            }
            // Update facing direction for the sprite even when stopped
            if (dir !== 'none') {
                state.direction = dir;
            }
        },

        lockHarpoon(locked: boolean): void {
            state.harpoonLocked = locked;
        },

        startPump(): void {
            if (!state.alive) return;
            if (!state.pumping) {
                state.pumping = true;
                if (!state.harpoonExtended) {
                    if (state.moving) {
                        timeline.clear();
                        state.x = state.col;
                        state.y = state.row;
                        state.moving = false;
                    }
                    state.harpoonExtended = true;
                    state.harpoonDistance = 0;
                }
                scheduleHarpoonExtend();
            }
        },

        stopPump(): void {
            if (state.pumping) {
                state.pumping = false;
                if (state.harpoonExtended && !state.harpoonLocked) {
                    scheduleHarpoonRetract();
                }
            }
        },

        kill(): void {
            state.alive = false;
            timeline.clear();
            harpoonTimeline.clear().time(0);
            state.moving = false;
            state.harpoonExtended = false;
            state.harpoonDistance = 0;
            state.harpoonLocked = false;
        },

        respawn(row: number, col: number): void {
            timeline.clear().time(0);
            harpoonTimeline.clear().time(0);
            state.x = col;
            state.y = row;
            state.col = col;
            state.row = row;
            state.direction = 'right';
            state.requestedDirection = 'none';
            state.moving = false;
            state.alive = true;
            state.harpoonExtended = false;
            state.harpoonDistance = 0;
            state.harpoonLocked = false;
            state.pumping = false;
        },

        update(deltaMs: number): void {
            if (!state.alive) return;

            // Advance timelines
            timeline.time(timeline.time() + 0.001 * deltaMs);
            if (state.harpoonExtended && !state.harpoonLocked) {
                harpoonTimeline.time(harpoonTimeline.time() + 0.001 * deltaMs);

                // Clamp to effective max (dirt may have changed)
                const max = effectiveHarpoonMax();
                if (state.harpoonDistance > max) {
                    state.harpoonDistance = max;
                }
            }

            // Orchestration: schedule next move when idle
            if (!state.harpoonExtended && !state.moving) {
                scheduleMove();
            }
        },
    };

    return model;
}
