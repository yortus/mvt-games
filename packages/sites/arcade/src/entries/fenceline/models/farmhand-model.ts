import { DIRECTION_DELTA, reverse, type Direction, type HeldDirection } from './common';
import type { FieldModel } from './field-model';
import { measureSegmentDistanceSquared } from './geometry';
import type { PlayerInput } from './player-input';
import { SLACK_DELAY_MS, SLACK_SPEED } from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Walking along the fences, stringing wire across the meadow from one fence
 * to another, or caught (`snapped`).
 */
export type FarmhandPhase = 'walking' | 'stringing' | 'snapped';

/**
 * The farmhand, who walks the fences and strings wire. They move from grid
 * point to grid point, along the lines between cells. Pushing off a fence
 * into open meadow starts a wire. The wire follows them until they reach a
 * fence again, and is then ready to tie off.
 * While they stand still with wire out, the wire goes slack from its post,
 * and slack that reaches them snaps it.
 */
export interface FarmhandModel {
    readonly phase: FarmhandPhase;
    /** Where the farmhand is, in grid steps. While they move, it is between two points. */
    readonly row: number;
    readonly col: number;
    /** The grid point the farmhand is at, or last left. */
    readonly pointRow: number;
    readonly pointCol: number;
    /** The way the farmhand faces, which is the way they last moved. */
    readonly direction: Direction;
    /** Whether the farmhand moved in the latest update. */
    readonly isMoving: boolean;
    /** How many points the wire runs through, from its post to the farmhand's last point. 0 with no wire out. */
    readonly wireLength: number;
    /** The wire's points, from its post. The first `wireLength` of each array are in use. */
    readonly wireRows: ArrayLike<number>;
    readonly wireCols: ArrayLike<number>;
    /** How much wire is out, in grid steps, from the post to the farmhand. */
    readonly wireDistance: number;
    /** How far along the wire from its post it has gone slack, in grid steps. 0 for none. */
    readonly slackDistance: number;
    /** Steps of wire strung this game. Each rise is a step. */
    readonly wireStepCount: number;
    /** Whether the wire has reached a fence, ready to tie off. */
    readonly hasReachedFence: boolean;
    /** Whether slack has reached the farmhand, snapping the wire. */
    readonly hasWireSnapped: boolean;
    /** Whether the wire, or the farmhand at its end, is closer than `reach` cells to (row, col). False with no wire out. */
    isWireWithin: (row: number, col: number, reach: number) => boolean;
    update: (deltaMs: number) => void;
    /** Takes in the wire once it has been tied off as fence. The farmhand walks on from where they are. */
    tieOff: () => void;
    /** Stops the farmhand where they are, caught. */
    snap: () => void;
    /** Puts the farmhand back on the fence, at the wire's post if they had wire out. The wire is gone. */
    respawn: () => void;
    /** Moves the farmhand to grid point (row, col), on a fence, as fences change around them. */
    moveTo: (row: number, col: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FarmhandModelOptions {
    /** The grid point to start at, on a fence. */
    readonly row: number;
    readonly col: number;
    /** Grid steps per second. */
    readonly speed: number;
    readonly input: PlayerInput;
    readonly field: Pick<FieldModel, 'rows' | 'cols' | 'isWalkable' | 'canString' | 'isOnFence'>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the farmhand, standing on a fence at a grid point. */
export function createFarmhandModel(options: FarmhandModelOptions): FarmhandModel {
    const { speed, input, field } = options;
    const pointCount = (field.rows + 1) * (field.cols + 1);
    const wireRows = new Int16Array(pointCount);
    const wireCols = new Int16Array(pointCount);
    // Whether each point is on the wire, indexed row * (cols + 1) + col
    const isOnWire = new Uint8Array(pointCount);

    let phase: FarmhandPhase = 'walking';
    let pointRow = options.row;
    let pointCol = options.col;
    let direction: Direction = 'left';
    // Whether the farmhand is between points, `progress` of the way to the next
    let isOnLine = false;
    let progress = 0;
    let isMoving = false;
    // Whether the farmhand is on the move, not stopped at a point since they set off
    let isUnderWay = false;
    let wireLength = 0;
    let wireStepCount = 0;
    let stillMs = 0;
    let slackDistance = 0;
    let hasReachedFence = false;
    let hasWireSnapped = false;
    // The way the latest swipe set the farmhand going, until the next swipe or a tap
    let swiped: HeldDirection = 'none';
    let swipesSeen = input.swipeCount;
    let tapsSeen = input.tapCount;

    const model: FarmhandModel = {
        get phase() { return phase; },
        get row() { return isOnLine ? pointRow + DIRECTION_DELTA[direction][0] * progress : pointRow; },
        get col() { return isOnLine ? pointCol + DIRECTION_DELTA[direction][1] * progress : pointCol; },
        get pointRow() { return pointRow; },
        get pointCol() { return pointCol; },
        get direction() { return direction; },
        get isMoving() { return isMoving; },
        get wireLength() { return wireLength; },
        wireRows,
        wireCols,
        get wireDistance() { return wireLength === 0 ? 0 : wireLength - 1 + (isOnLine ? progress : 0); },
        get slackDistance() { return slackDistance; },
        get wireStepCount() { return wireStepCount; },
        get hasReachedFence() { return hasReachedFence; },
        get hasWireSnapped() { return hasWireSnapped; },

        isWireWithin(row, col, reach) {
            if (wireLength === 0) return false;
            const reachSquared = reach * reach;
            for (let i = 1; i < wireLength; i++) {
                const distance = measureSegmentDistanceSquared(row, col, wireRows[i - 1], wireCols[i - 1], wireRows[i], wireCols[i]);
                if (distance < reachSquared) return true;
            }
            const last = wireLength - 1;
            return measureSegmentDistanceSquared(row, col, wireRows[last], wireCols[last], model.row, model.col) < reachSquared;
        },

        update(deltaMs) {
            isMoving = false;
            readSwipes();
            if (phase === 'snapped' || hasReachedFence || hasWireSnapped) return;
            move(speed * deltaMs * 0.001);
            if (phase === 'stringing') advanceSlack(deltaMs);
        },

        tieOff() {
            clearWire();
            phase = 'walking';
            hasReachedFence = false;
        },

        snap() {
            isUnderWay = false;
            swiped = 'none';
            phase = 'snapped';
            isOnLine = false;
            progress = 0;
            isMoving = false;
        },

        respawn() {
            isUnderWay = false;
            swiped = 'none';
            if (wireLength > 0) {
                pointRow = wireRows[0];
                pointCol = wireCols[0];
            }
            clearWire();
            phase = 'walking';
            isOnLine = false;
            progress = 0;
            hasReachedFence = false;
            hasWireSnapped = false;
        },

        moveTo(row, col) {
            isUnderWay = false;
            pointRow = row;
            pointCol = col;
            isOnLine = false;
            progress = 0;
        },
    };

    return model;

    // ---- Moving ------------------------------------------------------------

    /** Moves up to `steps` grid steps, point by point, stopping where the way ends. */
    function move(steps: number): void {
        let budget = steps;
        while (budget > 0) {
            if (!isOnLine) {
                const next = chooseDirection();
                if (next === 'none') {
                    isUnderWay = false;
                    return;
                }
                if (phase === 'walking' && !field.isWalkable(pointRow, pointCol, next)) startWire();
                direction = next;
                isOnLine = true;
                isUnderWay = true;
                progress = 0;
            }
            else if (phase === 'walking' && findHeldDirection() === reverse(direction)) {
                // Turning back along the same fence, from partway along it
                pointRow += DIRECTION_DELTA[direction][0];
                pointCol += DIRECTION_DELTA[direction][1];
                direction = reverse(direction);
                progress = 1 - progress;
            }
            const step = Math.min(budget, 1 - progress);
            progress += step;
            budget -= step;
            isMoving = true;
            if (progress >= 1) {
                arrive();
                if (hasReachedFence) return;
            }
        }
    }

    /**
     * Returns the way to go on from the point the farmhand is at, or none.
     * On a fence, they go the way held if a fence or open meadow lies that
     * way, starting a wire into the meadow. Otherwise, if under way, they keep
     * going the way they were, so a way pressed early is taken at the next
     * corner. With wire out, they go only the way held, never back onto the
     * wire.
     */
    function chooseDirection(): HeldDirection {
        const held = findHeldDirection();
        if (held === 'none') return 'none';
        if (phase === 'stringing') return canStringTo(held) ? held : 'none';
        if (field.isWalkable(pointRow, pointCol, held)) return held;
        if (field.canString(pointRow, pointCol, held)) return held;
        if (isUnderWay && held !== reverse(direction) && field.isWalkable(pointRow, pointCol, direction)) return direction;
        return 'none';
    }

    // ---- Steering ----------------------------------------------------------

    /** Takes in any new swipe or tap. A tap stops the farmhand. If both came at once, the tap wins. */
    function readSwipes(): void {
        if (input.swipeCount !== swipesSeen) {
            swipesSeen = input.swipeCount;
            swiped = input.swipeDirection;
        }
        if (input.tapCount !== tapsSeen) {
            tapsSeen = input.tapCount;
            swiped = 'none';
        }
    }

    /** Returns the way the farmhand is steered. That is the way held, or else the way last swiped. */
    function findHeldDirection(): HeldDirection {
        return input.direction !== 'none' ? input.direction : swiped;
    }

    function canStringTo(way: Direction): boolean {
        if (!field.canString(pointRow, pointCol, way)) return false;
        const row = pointRow + DIRECTION_DELTA[way][0];
        const col = pointCol + DIRECTION_DELTA[way][1];
        return isOnWire[row * (field.cols + 1) + col] === 0;
    }

    function arrive(): void {
        pointRow += DIRECTION_DELTA[direction][0];
        pointCol += DIRECTION_DELTA[direction][1];
        isOnLine = false;
        progress = 0;
        if (phase !== 'stringing') return;
        addWirePoint(pointRow, pointCol);
        wireStepCount++;
        if (field.isOnFence(pointRow, pointCol)) hasReachedFence = true;
    }

    // ---- The wire ----------------------------------------------------------

    function startWire(): void {
        phase = 'stringing';
        stillMs = 0;
        slackDistance = 0;
        addWirePoint(pointRow, pointCol);
    }

    function addWirePoint(row: number, col: number): void {
        wireRows[wireLength] = row;
        wireCols[wireLength] = col;
        wireLength++;
        isOnWire[row * (field.cols + 1) + col] = 1;
    }

    function clearWire(): void {
        for (let i = 0; i < wireLength; i++) {
            isOnWire[wireRows[i] * (field.cols + 1) + wireCols[i]] = 0;
        }
        wireLength = 0;
        slackDistance = 0;
        stillMs = 0;
    }

    /**
     * Lets the wire go slack from its post while the farmhand stands still,
     * after a moment's grace. Moving again takes up the slack.
     */
    function advanceSlack(deltaMs: number): void {
        if (isMoving) {
            stillMs = 0;
            slackDistance = 0;
            return;
        }
        stillMs += deltaMs;
        if (stillMs <= SLACK_DELAY_MS) return;
        slackDistance += SLACK_SPEED * deltaMs * 0.001;
        if (slackDistance >= model.wireDistance) {
            slackDistance = model.wireDistance;
            hasWireSnapped = true;
        }
    }
}
