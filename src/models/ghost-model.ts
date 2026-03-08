import gsap from 'gsap';
import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

export type GhostBehavior = 'chase' | 'ambush' | 'flank' | 'fickle';

const AMBUSH_LOOK_AHEAD = 4;
const FLANK_LOOK_AHEAD = 2;
const FICKLE_SCATTER_DIST = 8;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GhostModel {
    readonly x: number;
    readonly y: number;
    readonly col: number;
    readonly row: number;
    readonly direction: Direction;
    readonly color: number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GhostModelOptions {
    startRow: number;
    startCol: number;
    color: number;
    /** Tiles per second. */
    speed: number;
    /** Ghost behaviour pattern. */
    behavior: GhostBehavior;
    /** Returns whether the given tile can be walked on by this ghost. */
    isWalkable: (row: number, col: number) => boolean;
    /** Live reference to the primary chase target (typically Pac-Man). */
    chaseTarget: { readonly row: number; readonly col: number; readonly direction: Direction };
    /** For 'flank' behaviour — the partner ghost whose position is mirrored. */
    flankPartner?: { readonly row: number; readonly col: number };
    /** For 'fickle' behaviour — the tile to retreat to when close to the target. */
    scatterTarget?: { readonly row: number; readonly col: number };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];

export function createGhostModel(options: GhostModelOptions): GhostModel {
    const { startRow, startCol, color, speed, behavior, isWalkable, chaseTarget, flankPartner, scatterTarget } =
        options;

    const state = {
        x: startCol,
        y: startRow,
        col: startCol,
        row: startRow,
        direction: 'up' as Direction,
        moving: false,
    };

    // Paused timeline for tile-to-tile movement — advanced only via update().
    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    // ---- Helpers -----------------------------------------------------------

    const effectiveTarget = { row: 0, col: 0 };

    /** Compute the effective target tile based on behaviour pattern. */
    function updateEffectiveTarget(): void {
        switch (behavior) {
            case 'chase':
                effectiveTarget.row = chaseTarget.row;
                effectiveTarget.col = chaseTarget.col;
                break;
            case 'ambush': {
                const delta = DIRECTION_DELTA[chaseTarget.direction];
                effectiveTarget.row = chaseTarget.row + delta[0] * AMBUSH_LOOK_AHEAD;
                effectiveTarget.col = chaseTarget.col + delta[1] * AMBUSH_LOOK_AHEAD;
                break;
            }
            case 'flank': {
                const delta = DIRECTION_DELTA[chaseTarget.direction];
                const aheadR = chaseTarget.row + delta[0] * FLANK_LOOK_AHEAD;
                const aheadC = chaseTarget.col + delta[1] * FLANK_LOOK_AHEAD;
                if (flankPartner) {
                    effectiveTarget.row = aheadR + (aheadR - flankPartner.row);
                    effectiveTarget.col = aheadC + (aheadC - flankPartner.col);
                } else {
                    effectiveTarget.row = chaseTarget.row;
                    effectiveTarget.col = chaseTarget.col;
                }
                break;
            }
            case 'fickle': {
                const dist = Math.abs(chaseTarget.row - state.row) + Math.abs(chaseTarget.col - state.col);
                if (dist > FICKLE_SCATTER_DIST) {
                    effectiveTarget.row = chaseTarget.row;
                    effectiveTarget.col = chaseTarget.col;
                } else {
                    effectiveTarget.row = scatterTarget?.row ?? 0;
                    effectiveTarget.col = scatterTarget?.col ?? 0;
                }
                break;
            }
        }
    }

    function distanceSq(r1: number, c1: number, r2: number, c2: number): number {
        return (r1 - r2) ** 2 + (c1 - c2) ** 2;
    }

    /** Choose the best direction at the current tile. */
    function chooseDirection(): Direction {
        updateEffectiveTarget();
        const targetRow = effectiveTarget.row;
        const targetCol = effectiveTarget.col;
        const reverse = oppositeDirection(state.direction);
        let bestDir = state.direction;
        let bestDist = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            if (dir === reverse) continue; // ghosts cannot reverse
            const delta = DIRECTION_DELTA[dir];
            const nr = state.row + delta[0];
            const nc = state.col + delta[1];
            if (!isWalkable(nr, nc)) continue;
            const d = distanceSq(nr, nc, targetRow, targetCol);
            if (d < bestDist) {
                bestDist = d;
                bestDir = dir;
            }
        }

        // If nothing was found (dead-end), allow reversing
        if (bestDist === Infinity) {
            const reverseDelta = DIRECTION_DELTA[reverse];
            if (isWalkable(state.row + reverseDelta[0], state.col + reverseDelta[1])) {
                return reverse;
            }
        }

        return bestDir;
    }

    /** Schedule a single one-tile move on the timeline. */
    function scheduleMove(): void {
        const dir = chooseDirection();
        const delta = DIRECTION_DELTA[dir];
        const nextRow = state.row + delta[0];
        const nextCol = state.col + delta[1];

        if (!isWalkable(nextRow, nextCol)) return;

        state.direction = dir;
        state.moving = true;

        const duration = 1 / speed;
        const t = timeline.time();

        timeline.to(state, { x: nextCol, y: nextRow, duration, ease: 'none' }, t);
        timeline.set(state, { row: nextRow, col: nextCol, moving: false }, t + duration);
    }

    // ---- Public record -----------------------------------------------------

    const model: GhostModel = {
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
        color,

        update(deltaMs: number): void {
            // Advance the timeline
            timeline.time(timeline.time() + 0.001 * deltaMs);

            // If idle, schedule the next one-tile move
            if (!state.moving) scheduleMove();
        },
    };

    return model;
}
