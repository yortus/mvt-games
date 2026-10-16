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
    /** How long the cat still waits in its pen before it leaves, in milliseconds. 0 once it is released. */
    readonly releaseInMs: number;
    update: (deltaMs: number) => void;
}

/**
 * How a cat picks the tile it heads for. Each cat has its own way, so the
 * cats come at the mouse from different sides rather than in a line:
 *
 * - `'chase'` heads straight for the mouse.
 * - `'ambush'` heads for a few tiles ahead of the mouse, to cut it off.
 * - `'flank'` heads for the point opposite its partner across the tile just
 *   ahead of the mouse, so the two close in from both sides.
 * - `'fickle'` chases from afar, but heads home once it is close.
 */
export type CatBehavior = 'chase' | 'ambush' | 'flank' | 'fickle';

/**
 * What all the cats are doing. While they scatter, each heads for its home
 * corner, which gives the mouse a breather; while they chase, each hunts the
 * mouse its own way.
 */
export type CatMode = 'scatter' | 'chase';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CatModelOptions {
    startRow: number;
    startCol: number;
    /** The way the cat faces as it starts. Defaults to up. */
    startDirection?: Direction;
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
    /**
     * The tile the cat heads for while the cats scatter, and, for a fickle
     * cat, when it is close to the mouse. It may lie outside the maze, beyond
     * a corner, so the cat circles the corner's hedges rather than stopping.
     */
    homeCorner: { readonly row: number; readonly col: number };
    /**
     * What all the cats are doing now. A cat turns back as it changes, at the
     * next tile it reaches. Without it, the cat always chases.
     */
    mode?: () => CatMode;
    /**
     * How long the cat waits in its pen before it leaves, in milliseconds,
     * pacing up and down. Defaults to 0.
     */
    releaseDelayMs?: number;
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

/**
 * Creates a cat. At each tile it reaches, it takes the way that brings it
 * nearest the tile it is heading for, and never turns straight back unless
 * it must. It is leap-safe only in steps of less than one tile's move.
 */
export function createCatModel(options: CatModelOptions): CatModel {
    const {
        startRow, startCol, speed, behavior, isWalkable, chaseTarget, flankPartner, homeCorner, isInPen, penExit,
    } = options;
    const modeOf = options.mode ?? (() => 'chase' as const);

    const state = {
        row: startRow,
        col: startCol,
        tileRow: startRow,
        tileCol: startCol,
        direction: options.startDirection ?? 'up',
    };
    let releaseInMs = Math.max(0, options.releaseDelayMs ?? 0);
    /** The mode the cat last moved in. A change of mode turns it back. */
    let modeMovedIn = modeOf();
    let mustTurnBack = false;

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
        get releaseInMs() {
            return releaseInMs;
        },

        update(deltaMs: number): void {
            releaseInMs = Math.max(0, releaseInMs - deltaMs);
            const mode = modeOf();
            if (mode !== modeMovedIn) {
                modeMovedIn = mode;
                mustTurnBack = true;
            }

            // Advance the move; on arrival, the cat is on its new tile
            if (move.advance(state, deltaMs)) {
                state.tileRow = state.row;
                state.tileCol = state.col;
            }

            // If idle, schedule the next one-tile move
            if (!move.isMoving) {
                if (releaseInMs > 0) schedulePace();
                else scheduleMove();
            }
        },
    };

    return model;

    // ---- Helpers -----------------------------------------------------------

    /** Compute the effective target tile based on the mode and the behaviour pattern. */
    function updateEffectiveTarget(): void {
        if (modeMovedIn === 'scatter') {
            effectiveTarget.row = homeCorner.row;
            effectiveTarget.col = homeCorner.col;
            return;
        }
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
                const distSq = distanceSq(chaseTarget.row, chaseTarget.col, state.row, state.col);
                if (distSq > FICKLE_SCATTER_DIST * FICKLE_SCATTER_DIST) {
                    effectiveTarget.row = chaseTarget.row;
                    effectiveTarget.col = chaseTarget.col;
                }
                else {
                    effectiveTarget.row = homeCorner.row;
                    effectiveTarget.col = homeCorner.col;
                }
                break;
            }
        }
    }

    function distanceSq(r1: number, c1: number, r2: number, c2: number): number {
        return (r1 - r2) ** 2 + (c1 - c2) ** 2;
    }

    function canStep(dir: Direction): boolean {
        const delta = DIRECTION_DELTA[dir];
        return isWalkable(state.tileRow + delta[0], state.tileCol + delta[1]);
    }

    /** Choose the best direction at the current tile. */
    function chooseDirection(): Direction {
        const inPen = isInPen?.(state.tileRow, state.tileCol) ?? false;
        const reverse = oppositeDirection(state.direction);
        // A change of mode turns a cat out in the maze straight back, but never back into the pen.
        // A cat still in the pen just goes on out.
        if (mustTurnBack) {
            mustTurnBack = false;
            const delta = DIRECTION_DELTA[reverse];
            const isIntoPen = isInPen?.(state.tileRow + delta[0], state.tileCol + delta[1]) ?? false;
            if (!inPen && !isIntoPen && canStep(reverse)) return reverse;
        }
        if (inPen && penExit) {
            effectiveTarget.row = penExit.row;
            effectiveTarget.col = penExit.col;
        }
        else {
            updateEffectiveTarget();
        }
        const targetRow = effectiveTarget.row;
        const targetCol = effectiveTarget.col;
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
        if (bestDist === Infinity && canStep(reverse)) return reverse;

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

    /**
     * While it waits to leave, the cat paces slowly up and down its column of
     * the pen, between the tile it started on and the next one.
     */
    function schedulePace(): void {
        const dir: Direction = state.tileRow > startRow ? 'up' : state.tileRow < startRow ? 'down' : oppositeDirection(state.direction);
        if (!startPace(dir)) startPace(oppositeDirection(dir));
    }

    /** Starts a pace one tile `dir`, if that tile is in the pen. Returns whether it did. */
    function startPace(dir: Direction): boolean {
        if (dir === 'left' || dir === 'right') return false;
        const nextTileRow = state.tileRow + DIRECTION_DELTA[dir][0];
        const isPen = isInPen?.(nextTileRow, state.tileCol) ?? true;
        if (!isWalkable(nextTileRow, state.tileCol) || !isPen) return false;
        state.direction = dir;
        move.start(state, nextTileRow, state.tileCol, 1000 / (speed * PACE_SPEED_SHARE));
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const AMBUSH_LOOK_AHEAD = 4;
const FLANK_LOOK_AHEAD = 2;
const FICKLE_SCATTER_DIST = 8;
/** How fast a cat paces in its pen, as a share of its speed. */
const PACE_SPEED_SHARE = 0.5;
