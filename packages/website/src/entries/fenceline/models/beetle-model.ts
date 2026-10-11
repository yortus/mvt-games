import { DIRECTION_DELTA, reverse, turnLeft, turnRight, type Direction } from './common';
import { BEETLE_HATCH_MS } from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Hatching, harmless and still, or crawling along the fences. */
export type BeetlePhase = 'hatching' | 'crawling';

/**
 * Which way a beetle turns first where fences meet. A right-handed beetle
 * keeps to its right-hand fence, so the beetles go round the open meadow,
 * some one way and some the other.
 */
export type BeetleHand = 'left' | 'right';

/**
 * A fence beetle. It crawls along the fences from grid point to grid point,
 * turning to its own hand first where fences meet, and catches the farmhand
 * if it reaches them. It never leaves the fences, so a farmhand out in the
 * meadow is safe from it.
 */
export interface BeetleModel {
    readonly phase: BeetlePhase;
    /** Where it is, in grid steps: between two points while it crawls. */
    readonly row: number;
    readonly col: number;
    /** The way it crawls. */
    readonly direction: Direction;
    /** How far it has hatched, from 0 to 1. */
    readonly hatchProgress: number;
    update: (deltaMs: number) => void;
    /** Moves it to grid point (row, col), as fences change around it. */
    moveTo: (row: number, col: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BeetleModelOptions {
    /** The grid point it hatches at, on a fence. */
    readonly row: number;
    readonly col: number;
    readonly direction: Direction;
    readonly hand: BeetleHand;
    /** Grid steps per second. */
    readonly speed: number;
    /** Whether it can crawl from point (row, col) one step `direction`. */
    readonly isWalkable: (row: number, col: number, direction: Direction) => boolean;
    /** Whether it starts hatching, rather than already crawling. */
    readonly isHatching: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a beetle at a grid point on a fence. */
export function createBeetleModel(options: BeetleModelOptions): BeetleModel {
    const { hand, speed, isWalkable } = options;

    let phase: BeetlePhase = options.isHatching ? 'hatching' : 'crawling';
    let hatchMs = 0;
    let pointRow = options.row;
    let pointCol = options.col;
    let direction = options.direction;
    // Whether it is between points, `progress` of the way to the next
    let isOnLine = false;
    let progress = 0;

    const model: BeetleModel = {
        get phase() { return phase; },
        get row() { return isOnLine ? pointRow + DIRECTION_DELTA[direction][0] * progress : pointRow; },
        get col() { return isOnLine ? pointCol + DIRECTION_DELTA[direction][1] * progress : pointCol; },
        get direction() { return direction; },
        get hatchProgress() { return phase === 'hatching' ? hatchMs / BEETLE_HATCH_MS : 1; },

        update(deltaMs) {
            if (phase === 'hatching') {
                hatchMs += deltaMs;
                if (hatchMs >= BEETLE_HATCH_MS) phase = 'crawling';
                return;
            }
            crawl(speed * deltaMs * 0.001);
        },

        moveTo(row, col) {
            pointRow = row;
            pointCol = col;
            isOnLine = false;
            progress = 0;
        },
    };

    return model;

    function crawl(steps: number): void {
        let budget = steps;
        while (budget > 0) {
            if (!isOnLine) {
                const next = chooseDirection();
                if (next === undefined) return;
                direction = next;
                isOnLine = true;
                progress = 0;
            }
            else if (!isWalkable(pointRow, pointCol, direction)) {
                // The fence under it was left behind: back to the point it came from
                isOnLine = false;
                progress = 0;
                continue;
            }
            const step = Math.min(budget, 1 - progress);
            progress += step;
            budget -= step;
            if (progress >= 1) {
                pointRow += DIRECTION_DELTA[direction][0];
                pointCol += DIRECTION_DELTA[direction][1];
                isOnLine = false;
                progress = 0;
            }
        }
    }

    /** Its own hand first, then straight on, then the other hand, and back only at a dead end. */
    function chooseDirection(): Direction | undefined {
        const first = hand === 'right' ? turnRight(direction) : turnLeft(direction);
        if (isWalkable(pointRow, pointCol, first)) return first;
        if (isWalkable(pointRow, pointCol, direction)) return direction;
        const other = reverse(first);
        if (isWalkable(pointRow, pointCol, other)) return other;
        const back = reverse(direction);
        if (isWalkable(pointRow, pointCol, back)) return back;
        return undefined;
    }
}
