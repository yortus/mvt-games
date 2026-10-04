import { type Direction, DIRECTION_DELTA, oppositeDirection } from './common';
import { createTileMove } from './tile-move';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CatModel {
    /** Current row position (fractional while moving between tiles). */
    readonly row: number;
    /** Current column position (fractional while moving between tiles). */
    readonly col: number;
    readonly direction: Direction;
    update: (deltaMs: number) => void;
}

export type CatBehavior = 'chase' | 'ambush' | 'flank' | 'fickle';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CatModelOptions {
    startRow: number;
    startCol: number;
    /** Tiles per second. */
    speed: number;
    /** Cat behaviour pattern. */
    behavior: CatBehavior;
    /** Returns whether the given tile can be walked on by this cat. */
    isWalkable: (row: number, col: number) => boolean;
    /** Live reference to the primary chase target (typically the mouse). */
    chaseTarget: { readonly row: number; readonly col: number; readonly direction: Direction };
    /** For 'flank' behaviour - the partner cat whose position is mirrored. */
    flankPartner?: { readonly row: number; readonly col: number };
    /** For 'fickle' behaviour - the tile to retreat to when close to the target. */
    scatterTarget?: { readonly row: number; readonly col: number };
    /**
     * Whether a tile is part of the pen the cat starts in. A cat in the pen
     * heads for `penExit` whatever its behaviour, and once out, never goes
     * back in. Without it, the cat treats the pen like any other tile.
     */
    isInPen?: (row: number, col: number) => boolean;
    /** The tile just outside the pen's way out. */
    penExit?: { readonly row: number; readonly col: number };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCatModel(options: CatModelOptions): CatModel {
    const {
        startRow, startCol, speed, behavior, isWalkable, chaseTarget, flankPartner, scatterTarget, isInPen, penExit,
    } = options;

    const state = {
        row: startRow,
        col: startCol,
        tileRow: startRow,
        tileCol: startCol,
        direction: 'up' as Direction,
    };

    // The current tile-to-tile move, advanced only via update().
    const move = createTileMove();

    // ---- Helpers -----------------------------------------------------------

    const effectiveTarget = { row: 0, col: 0 };

    // ---- Public record -----------------------------------------------------

    const model: CatModel = {
        get row() {
            return state.row;
        },
        get col() {
            return state.col;
        },
        get direction() {
            return state.direction;
        },

        update(deltaMs: number): void {
            // Advance the move; on arrival, the cat is on its new tile
            if (move.advance(state, deltaMs)) {
                state.tileRow = state.row;
                state.tileCol = state.col;
            }

            // If idle, schedule the next one-tile move
            if (!move.isMoving) scheduleMove();
        },
    };

    return model;

    // ---- Helpers -----------------------------------------------------------

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
                }
                else {
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
                }
                else {
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
        const inPen = isInPen?.(state.tileRow, state.tileCol) ?? false;
        if (inPen && penExit) {
            effectiveTarget.row = penExit.row;
            effectiveTarget.col = penExit.col;
        }
        else {
            updateEffectiveTarget();
        }
        const targetRow = effectiveTarget.row;
        const targetCol = effectiveTarget.col;
        const reverse = oppositeDirection(state.direction);
        let bestDir = state.direction;
        let bestDist = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            if (dir === reverse) continue; // cats cannot reverse
            const delta = DIRECTION_DELTA[dir];
            const nr = state.tileRow + delta[0];
            const nc = state.tileCol + delta[1];
            if (!isWalkable(nr, nc)) continue;
            if (!inPen && isInPen?.(nr, nc)) continue; // once out, cats stay out

            const d = distanceSq(nr, nc, targetRow, targetCol);
            if (d < bestDist) {
                bestDist = d;
                bestDir = dir;
            }
        }

        // If nothing was found (dead-end), allow reversing
        if (bestDist === Infinity) {
            const reverseDelta = DIRECTION_DELTA[reverse];
            if (isWalkable(state.tileRow + reverseDelta[0], state.tileCol + reverseDelta[1])) {
                return reverse;
            }
        }

        return bestDir;
    }

    /** Start a single one-tile move. */
    function scheduleMove(): void {
        const dir = chooseDirection();
        const delta = DIRECTION_DELTA[dir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];

        if (!isWalkable(nextTileRow, nextTileCol)) return;

        state.direction = dir;
        move.start(state, nextTileRow, nextTileCol, 1000 / speed);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const AMBUSH_LOOK_AHEAD = 4;
const FLANK_LOOK_AHEAD = 2;
const FICKLE_SCATTER_DIST = 8;
